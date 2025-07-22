#!/bin/bash

# Source nvm for the session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Add bun to PATH
export PATH="/home/node/.bun/bin:/usr/local/bin:$PATH"

# Default to Node 22
nvm use 22

# Execute the command passed to the container
exec "$@"