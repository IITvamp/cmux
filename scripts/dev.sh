#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Terminal App Development Environment...${NC}"

# Change to app directory
cd "$APP_DIR"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down...${NC}"
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if node_modules exist, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo -e "${BLUE}Installing server dependencies...${NC}"
    cd server && npm install && cd ..
fi

# Start the backend server
echo -e "${GREEN}Starting backend server on port 3001...${NC}"
(cd server && npm run dev) &
SERVER_PID=$!

# Start the frontend
echo -e "${GREEN}Starting frontend on port 5173...${NC}"
npm run dev &
CLIENT_PID=$!

echo -e "${GREEN}Terminal app is running!${NC}"
echo -e "${BLUE}Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}Backend: http://localhost:3001${NC}"
echo -e "\nPress Ctrl+C to stop all services"

# Wait for both processes
wait