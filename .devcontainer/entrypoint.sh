#!/bin/bash

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

# Execute the command passed to the container
exec "$@"