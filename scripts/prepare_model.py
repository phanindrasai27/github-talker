#!/usr/bin/env python3
import os
import sys
import subprocess
from huggingface_hub import hf_hub_download, snapshot_download
from pathlib import Path
import shutil

def download_model():
    """Download Llama-2-7b-chat model from TheBloke's quantized version."""
    print("Downloading quantized Llama-2-7b-chat model...")
    model_path = hf_hub_download(
        repo_id="TheBloke/Llama-2-7B-Chat-GGUF",
        filename="llama-2-7b-chat.Q4_K_M.gguf",
        local_dir="./models",
    )
    return model_path

def setup_model():
    """Set up the model for use."""
    print("Setting up model...")
    
    # Create models directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    
    # Check if model already exists
    target_path = Path("models/ggml-model.bin")
    if target_path.exists():
        print("Quantized model already exists, skipping preparation")
        return str(target_path)
    
    # Download the model
    model_path = download_model()
    
    # Copy the file instead of symlinking
    shutil.copy2(model_path, target_path)
    
    print("Model preparation complete!")
    return str(target_path)

def main():
    """Main function to prepare the model for deployment."""
    try:
        model_path = setup_model()
        print(f"Model ready at: {model_path}")
    except Exception as e:
        print(f"Error preparing model: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 