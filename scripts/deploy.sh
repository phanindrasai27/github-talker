#!/bin/bash
set -e

# Setup Fly.io environment
setup_flyctl() {
    # Install flyctl if not installed
    if ! command -v flyctl &> /dev/null; then
        echo "Installing flyctl..."
        curl -L https://fly.io/install.sh | sh
        
        # Setup environment variables
        export FLYCTL_INSTALL="$HOME/.fly"
        export PATH="$FLYCTL_INSTALL/bin:$PATH"
        
        # Add to shell config if not already present
        if ! grep -q "FLYCTL_INSTALL" "$HOME/.zshrc"; then
            echo 'export FLYCTL_INSTALL="$HOME/.fly"' >> "$HOME/.zshrc"
            echo 'export PATH="$FLYCTL_INSTALL/bin:$PATH"' >> "$HOME/.zshrc"
        fi
    fi
}

# Main deployment process
main() {
    # Setup flyctl
    setup_flyctl
    
    # Verify flyctl is available
    if ! command -v flyctl &> /dev/null; then
        echo "Error: flyctl not found. Please restart your terminal and try again."
        exit 1
    fi
    
    echo "Starting deployment process..."
    
    # Ensure we're logged in
    if ! flyctl auth whoami &> /dev/null; then
        echo "Please log in to Fly.io:"
        flyctl auth login
    fi
    
    # Create the app if it doesn't exist
    if ! flyctl apps list | grep -q "github-talker"; then
        echo "Creating new Fly.io app..."
        flyctl apps create github-talker
    fi
    
    # Create volume for model storage if it doesn't exist
    if ! flyctl volumes list | grep -q "github_talker_data"; then
        echo "Creating storage volume..."
        flyctl volumes create github_talker_data --size 10
    fi
    
    # Download and quantize model
    echo "Preparing model..."
    python3 scripts/prepare_model.py
    
    # Deploy the app
    echo "Deploying to Fly.io..."
    flyctl deploy
    
    # Scale to free tier limits
    echo "Scaling to free tier limits..."
    flyctl scale vm shared-cpu-1x --memory 256
    
    echo "Deployment complete! Your app is running at https://github-talker.fly.dev"
    echo "View logs with: flyctl logs"
    echo "Check status with: flyctl status"
}

# Run main function
main 