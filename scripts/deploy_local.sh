#!/bin/bash
set -e

echo "Starting local deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is required but not installed. Please install Docker first."
    exit 1
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t github-talker .

# Check if the container is already running
if docker ps | grep -q github-talker; then
    echo "Stopping existing container..."
    docker stop github-talker
    docker rm github-talker
fi

# Create a volume for model storage if it doesn't exist
if ! docker volume ls | grep -q github_talker_data; then
    echo "Creating Docker volume for model storage..."
    docker volume create github_talker_data
fi

# Download and prepare model
echo "Preparing model..."
python3 scripts/prepare_model.py

# Run the container
echo "Starting container..."
docker run -d \
    --name github-talker \
    -p 8000:8000 \
    -p 8080:8080 \
    -v github_talker_data:/app/models \
    github-talker

echo "Deployment complete!"
echo "Backend API is running at http://localhost:8000"
echo "LLM server is running at http://localhost:8080"
echo ""
echo "To view logs:"
echo "  docker logs -f github-talker"
echo ""
echo "To stop the server:"
echo "  docker stop github-talker" 