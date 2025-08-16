#!/bin/bash

# Fix Docker socket permissions if it exists
if [ -S /var/run/docker.sock ]; then
    chmod 666 /var/run/docker.sock
fi

# Source nvm for the session if it exists
export NVM_DIR="/home/node/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    # Default to Node 24 if nvm is available
    nvm use 24 2>/dev/null || true
fi

# Add bun to PATH
export PATH="/home/node/.bun/bin:/usr/local/bin:$PATH"

# Activate corepack for pnpm
corepack enable 2>/dev/null || true

# Execute the command passed to the container
exec "$@"