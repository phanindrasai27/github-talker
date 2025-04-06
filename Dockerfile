# Use Ubuntu 22.04 as base
FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    python3-pip \
    python3-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Clone and build llama.cpp with CMake
WORKDIR /app
RUN git clone https://github.com/ggerganov/llama.cpp && \
    cd llama.cpp && \
    mkdir build && \
    cd build && \
    cmake .. && \
    cmake --build . --config Release && \
    cp bin/server /usr/local/bin/llama-server

# Set up Python environment
COPY backend/requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend /app/backend
COPY scripts /app/scripts

# Create model directory
RUN mkdir -p /app/models

# Set environment variables
ENV PYTHONPATH=/app
ENV MODEL_PATH=/app/models/ggml-model.bin

# Download and convert model script will be run separately
# as part of the deployment process

# Expose FastAPI port
EXPOSE 8000
EXPOSE 8080

# Start both llama.cpp server and FastAPI
CMD ["sh", "-c", "llama-server -m /app/models/ggml-model.bin -c 2048 --host 0.0.0.0 --port 8080 & cd /app/backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"] 