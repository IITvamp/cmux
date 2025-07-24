#!/bin/bash

docker build -t coderouter-worker:0.0.1 .

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Terminal App Development Environment...${NC}"

# Change to app directory
cd "$APP_DIR"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down...${NC}"
    kill $SERVER_PID $CLIENT_PID $CONVEX_BACKEND_PID $CONVEX_DEV_PID 2>/dev/null
    exit
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if node_modules exist, if not install dependencies
if [ ! -d "node_modules" ] || [ "$FORCE_INSTALL" = "true" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    CI=1 pnpm install --frozen-lockfile
fi

# Start the backend server
echo -e "${GREEN}Starting backend server on port 3001...${NC}"
(cd apps/server && bun run dev) &
SERVER_PID=$!

# Start the frontend
echo -e "${GREEN}Starting frontend on port 5173...${NC}"
(cd apps/client && bun run dev) &
CLIENT_PID=$!

# Create logs directory if it doesn't exist
mkdir -p "$APP_DIR/logs"

# Start convex dev and log to both stdout and file
echo -e "${GREEN}Starting convex dev...${NC}"
# (cd packages/convex && source ~/.nvm/nvm.sh && nvm use 18 && CONVEX_AGENT_MODE=anonymous bun x convex dev 2>&1 | tee ../../logs/convex.log) &
(cd packages/convex && source ~/.nvm/nvm.sh && \
  nvm use 18 && \
  source .env.local && \
  ./convex-local-backend \
    --port "$VITE_CONVEX_PORT" \
    --site-proxy-port "$VITE_CONVEX_SITE_PROXY_PORT" \
    --instance-name "$CONVEX_INSTANCE_NAME" \
    --instance-secret "$CONVEX_INSTANCE_SECRET" \
    --disable-beacon \
    2>&1 | tee ../../logs/convex.log) &
CONVEX_BACKEND_PID=$!

(cd packages/convex && source ~/.nvm/nvm.sh && \
  nvm use 18 && \
  bunx convex dev \
    2>&1 | tee ../../logs/convex-dev.log) &
CONVEX_DEV_PID=$!
CONVEX_PID=$!

echo -e "${GREEN}Terminal app is running!${NC}"
echo -e "${BLUE}Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}Backend: http://localhost:3001${NC}"
echo -e "${BLUE}Convex: http://localhost:$VITE_CONVEX_PORT${NC}"
echo -e "\nPress Ctrl+C to stop all services"

# Wait for both processes
wait