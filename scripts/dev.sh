#!/bin/bash

set -e

CONVEX_PORT=9777

# Build Docker image by default unless explicitly skipped
if [ "$SKIP_DOCKER_BUILD" != "true" ]; then
    echo "Building Docker image..."
    docker build -t cmux-worker:0.0.1 . || exit 1
else
    echo "Skipping Docker build (SKIP_DOCKER_BUILD=true)"
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Terminal App Development Environment...${NC}"

# Change to app directory
cd "$APP_DIR"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down...${NC}"
    kill $SERVER_PID $CLIENT_PID $CONVEX_DEV_PID $DOCKER_COMPOSE_PID 2>/dev/null
    exit
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if node_modules exist, if not install dependencies
if [ ! -d "node_modules" ] || [ "$FORCE_INSTALL" = "true" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    CI=1 pnpm install --frozen-lockfile || exit 1
fi

# Function to prefix output with colored labels
prefix_output() {
    local label="$1"
    local color="$2"
    while IFS= read -r line; do
        echo -e "${color}[${label}]${NC} $line"
    done
}

# Create logs directory if it doesn't exist
mkdir -p "$APP_DIR/logs"

# Start convex dev and log to both stdout and file
echo -e "${GREEN}Starting convex dev...${NC}"
# (cd packages/convex && source ~/.nvm/nvm.sh && nvm use 18 && CONVEX_AGENT_MODE=anonymous bun x convex dev 2>&1 | tee ../../logs/convex.log) &
# (cd packages/convex && source ~/.nvm/nvm.sh && \
#   nvm use 18 && \
#   source .env.local && \
#   ./convex-local-backend \
#     --port "$CONVEX_PORT" \
#     --site-proxy-port "$CONVEX_SITE_PROXY_PORT" \
#     --instance-name "$CONVEX_INSTANCE_NAME" \
#     --instance-secret "$CONVEX_INSTANCE_SECRET" \
#     --disable-beacon \
#     2>&1 | tee ../../logs/convex.log | prefix_output "CONVEX-BACKEND" "$MAGENTA") &
# CONVEX_BACKEND_PID=$!

# Function to check if a background process started successfully
check_process() {
    local pid=$1
    local name=$2
    sleep 0.5  # Give the process a moment to start
    if ! kill -0 $pid 2>/dev/null; then
        echo -e "${RED}Failed to start $name${NC}"
        exit 1
    fi
}

(cd .devcontainer && docker compose up 2>&1 | prefix_output "DOCKER-COMPOSE" "$MAGENTA") &
DOCKER_COMPOSE_PID=$!
check_process $DOCKER_COMPOSE_PID "Docker Compose"

(cd packages/convex && source ~/.nvm/nvm.sh && \
  bunx convex dev --env-file .env.convex \
    2>&1 | tee ../../logs/convex-dev.log | prefix_output "CONVEX-DEV" "$GREEN") &
CONVEX_DEV_PID=$!
check_process $CONVEX_DEV_PID "Convex Dev"
CONVEX_PID=$CONVEX_DEV_PID


# Start the backend server
echo -e "${GREEN}Starting backend server on port 9776...${NC}"
(cd apps/server && bun run dev 2>&1 | prefix_output "SERVER" "$YELLOW") &
SERVER_PID=$!
check_process $SERVER_PID "Backend Server"

# Start the frontend
echo -e "${GREEN}Starting frontend on port 5173...${NC}"
(cd apps/client && VITE_CONVEX_URL=http://localhost:$CONVEX_PORT bun run dev 2>&1 | prefix_output "CLIENT" "$CYAN") &
CLIENT_PID=$!
check_process $CLIENT_PID "Frontend Client"

echo -e "${GREEN}Terminal app is running!${NC}"
echo -e "${BLUE}Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}Backend: http://localhost:9776${NC}"
echo -e "${BLUE}Convex: http://localhost:$CONVEX_PORT${NC}"
echo -e "\nPress Ctrl+C to stop all services"

# Wait for both processes
wait