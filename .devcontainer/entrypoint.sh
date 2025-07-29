#!/bin/bash

# Fix Docker socket permissions if it exists
if [ -S /var/run/docker.sock ]; then
    chmod 666 /var/run/docker.sock
fi

# Source nvm for the session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Add bun to PATH
export PATH="/home/node/.bun/bin:/usr/local/bin:$PATH"

# Activate corepack for pnpm
corepack enable

# Default to Node 24
nvm use 24

# Set up devcontainer
if [ -f "/workspace/.devcontainer/devcontainer.json" ]; then
    echo "Setting up devcontainer..."
    cd /workspace && bunx @devcontainers/cli up --workspace-folder . --remove-existing-container || echo "Devcontainer setup completed or already configured"
fi

# Execute the command passed to the container
exec "$@"