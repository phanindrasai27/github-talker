from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
from langchain.document_loaders import GitHubRepoLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS
from langchain.llms.base import LLM
from langchain.chains import ConversationalRetrievalChain, LLMChain
from langchain.memory import ConversationBufferMemory, CombinedMemory, ConversationSummaryMemory
from langchain.prompts import PromptTemplate
from fastapi.middleware.cors import CORSMiddleware
import json
from collections import Counter
from pathlib import Path
import requests

# Load environment variables
load_dotenv()

class LlamaCppLLM(LLM):
    """LLM wrapper for llama.cpp server."""
    
    def __init__(self):
        super().__init__()
        self.base_url = "http://localhost:8080"
        
    def _call(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        """Call the llama.cpp server."""
        response = requests.post(
            f"{self.base_url}/completion",
            json={
                "prompt": prompt,
                "n_predict": 512,
                "temperature": 0.7,
                "stop": stop or []
            }
        )
        response.raise_for_status()
        return response.json()["content"]
    
    @property
    def _llm_type(self) -> str:
        return "llama.cpp"

app = FastAPI(title="GitHub Talker API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize embeddings with free model
embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-base-en-v1.5",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True}
)

# Use llama.cpp server
llm = LlamaCppLLM()

# Store for repository data
class RepoStore:
    def __init__(self):
        self.chains: Dict[str, ConversationalRetrievalChain] = {}
        self.summaries: Dict[str, str] = {}
        self.stats: Dict[str, Dict] = {}
        self.vectorstores: Dict[str, FAISS] = {}

stores = RepoStore()

class LoadRequest(BaseModel):
    repo_url: str

class ChatRequest(BaseModel):
    repo_url: str
    question: str

class RepoStats(BaseModel):
    file_count: int
    language_stats: Dict[str, int]
    total_size: int

def analyze_repo_stats(docs) -> RepoStats:
    """Analyze repository statistics."""
    extensions = Counter()
    total_size = 0
    
    for doc in docs:
        path = Path(doc.metadata.get('source', ''))
        if path.suffix:
            extensions[path.suffix[1:]] += 1
        total_size += len(doc.page_content)
    
    return RepoStats(
        file_count=len(docs),
        language_stats=dict(extensions),
        total_size=total_size
    )

def create_systematic_summary_chain(llm):
    """Create a chain for systematic repository summary."""
    summary_template = """
    Analyze this codebase and provide a systematic summary including:
    1. Overview of the main purpose and functionality
    2. Key architectural components and their relationships
    3. Important classes and functions
    4. Notable patterns and design decisions
    
    Code context:
    {context}
    
    Systematic Summary:
    """
    
    summary_prompt = PromptTemplate(
        input_variables=["context"],
        template=summary_template
    )
    
    return LLMChain(llm=llm, prompt=summary_prompt)

@app.post("/api/load")
async def load_repo(req: LoadRequest):
    try:
        # Configure GitHub loader (for public repos only)
        loader = GitHubRepoLoader(
            repo_path=req.repo_url,
            clone_url=req.repo_url,
            branch="main",
            file_filter=lambda fp: fp.endswith((".py", ".md", ".js", ".ts", ".jsx", ".tsx", ".json"))
        )
        docs = loader.load()
        
        # Analyze repository statistics
        repo_stats = analyze_repo_stats(docs)
        
        # Split documents into chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_documents(docs)
        
        # Create vector store
        vectorstore = FAISS.from_documents(chunks, embeddings)
        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4}
        )
        
        # Initialize advanced memory system
        buffer_memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            output_key="answer"
        )
        
        summary_memory = ConversationSummaryMemory(
            llm=llm,
            memory_key="chat_summary",
            return_messages=True
        )
        
        memory = CombinedMemory(
            memories=[buffer_memory, summary_memory]
        )
        
        # Create the conversational chain
        chain = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=retriever,
            memory=memory,
            return_source_documents=True,
            chain_type="stuff"
        )
        
        # Generate systematic summary
        summary_chain = create_systematic_summary_chain(llm)
        summary = summary_chain.run(context="\n\n".join([d.page_content for d in chunks[:5]]))
        
        # Store everything
        stores.chains[req.repo_url] = chain
        stores.summaries[req.repo_url] = summary
        stores.stats[req.repo_url] = repo_stats.dict()
        stores.vectorstores[req.repo_url] = vectorstore
        
        return {
            "status": "loaded",
            "summary": summary,
            "stats": repo_stats.dict()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": str(e), "type": type(e).__name__}
        )

@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        chain = stores.chains.get(req.repo_url)
        if not chain:
            raise HTTPException(status_code=400, detail="Repository not loaded")
        
        # Get response from chain
        result = chain({
            "question": req.question,
            "chat_history": []
        })
        
        # Extract source snippets
        source_docs = result.get("source_documents", [])
        sources = [
            {
                "content": doc.page_content,
                "metadata": doc.metadata
            }
            for doc in source_docs[:2]  # Return top 2 most relevant snippets
        ] if source_docs else []
        
        return {
            "answer": result["answer"],
            "sources": sources,
            "summary": stores.summaries.get(req.repo_url)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": str(e), "type": type(e).__name__}
        )

@app.get("/api/repos/{repo_url}/stats")
async def get_repo_stats(repo_url: str):
    """Get repository statistics."""
    stats = stores.stats.get(repo_url)
    if not stats:
        raise HTTPException(status_code=404, detail="Repository not found")
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 