# GitHub Talker

A full-stack application that allows you to chat with your GitHub repositories using LangChain and LLMs.

## Features

- Load any public GitHub repository
- Chat with the codebase using natural language
- View relevant code snippets in context
- Get repository summaries
- Modern, responsive UI

## Tech Stack

- **Backend**: FastAPI, LangChain, HuggingFace Embeddings, FAISS
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **LLM**: Mistral-7B via OpenRouter
- **Deployment**: Railway (Backend), Vercel (Frontend)

## Setup

### Prerequisites

- Python 3.8+
- Node.js 16+
- OpenRouter API key

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

5. Run the backend:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Enter a GitHub repository URL (e.g., `https://github.com/username/repo`)
3. Click "Load" to process the repository
4. Start asking questions about the codebase
5. View relevant code snippets in the context panel

## Deployment

### Backend (Railway)

1. Create a Railway account
2. Connect your GitHub repository
3. Set the `OPENROUTER_API_KEY` environment variable
4. Deploy

### Frontend (Vercel)

1. Create a Vercel account
2. Import your GitHub repository
3. Set the backend URL in environment variables
4. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 