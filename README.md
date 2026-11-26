# GitHub Talker

A full-stack codebase intelligence workspace that lets you ingest, explore, and chat with any public GitHub repository using hybrid semantic retrieval and grounded line-numbered code citations.

## Features

- **Direct GitHub Ingestion**: Load any public repository by URL (`https://github.com/owner/repo` or `owner/repo`), with optional branch selection and configurable file indexing depth (`40`, `60`, or `100` priority files).
- **Hybrid Semantic + Lexical Retrieval**: Line-aware code chunking paired with Gemini embeddings (`gemini-embedding-2`) and symbol/path scoring so both architecture questions and exact function lookups return precise line ranges.
- **Streaming Grounded Chat**: Live token streaming via `gemini-4-hydrogen` over Server-Sent Events (SSE), complete with Markdown rendering, copyable code blocks, conversation memory, and clickable cited source snippets.
- **Interactive File Tree & Code Viewer**: Browse and filter the full repository file tree, inspect any file on demand with line numbers and citation highlighting, and pin specific files to focus follow-up chat questions.
- **Architectural Summary & Export**: Automatically generates a structured architectural overview, core components, design patterns, clickable key entry points, language breakdown, and Markdown export.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **AI & Retrieval**: `@google/genai` (`gemini-4-hydrogen` + `gemini-embedding-2`) running strictly server-side in Next.js API routes
- **Repository Access**: GitHub REST API & Raw Content CDN

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key
   # Optional: increases GitHub REST API rate limits
   GITHUB_TOKEN=your_github_token
   ```

3. Start the development server on port 3000:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   npm start
   ```