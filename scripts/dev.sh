#!/bin/bash
set -e

echo "Starting development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Prepare model if needed
if [ ! -f "models/ggml-model.bin" ]; then
    echo "Preparing model..."
    python3 scripts/prepare_model.py
fi

# Start backend services with Docker Compose
echo "Starting backend services..."
docker compose up --build -d

echo "Development environment is ready!"
echo "- Backend API is running at http://localhost:8000"
echo "- LLM server is running at http://localhost:8080"
echo "- Frontend is running at http://localhost:3002"
echo ""
echo "To view backend logs:"
echo "  docker compose logs -f"
echo ""
echo "To stop backend services:"
echo "  docker compose down" 