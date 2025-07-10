# #!/bin/bash

# # Get the directory where this script is located
# SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# APP_DIR="$(dirname "$SCRIPT_DIR")"
# CONVEX_DIR="$APP_DIR/packages/convex"

# # Colors for output
# GREEN='\033[0;32m'
# BLUE='\033[0;34m'
# YELLOW='\033[0;33m'
# RED='\033[0;31m'
# NC='\033[0m' # No Color

# echo -e "${BLUE}Setting up Convex for development...${NC}"

# # Change to convex directory
# cd "$CONVEX_DIR"

# # Check if we're in a devcontainer
# if [ -n "$REMOTE_CONTAINERS" ] || [ -n "$CODESPACES" ] || [ -f "/.dockerenv" ]; then
#     echo -e "${BLUE}Detected devcontainer environment${NC}"
    
#     # In devcontainer, always create fresh configuration
#     echo -e "${GREEN}Creating Convex configuration for devcontainer...${NC}"
    
#     # Remove any existing .env.local to ensure clean setup
#     rm -f .env.local
    
#     # Create .env.local with the deployment name that Convex expects
#     cat > .env.local << EOF
# CONVEX_DEPLOYMENT=anonymous-coderouter
# VITE_CONVEX_URL=http://127.0.0.1:3212
# EOF
    
#     # Create the Convex backend state directory structure
#     echo -e "${BLUE}Home directory: $HOME${NC}"
#     CONVEX_STATE_DIR="$HOME/.convex/anonymous-convex-backend-state"
#     echo -e "${BLUE}Creating Convex state directory: $CONVEX_STATE_DIR${NC}"
#     mkdir -p "$CONVEX_STATE_DIR/anonymous-coderouter"
    
#     # Create the config.json for the anonymous backend state
#     if [ ! -f "$CONVEX_STATE_DIR/config.json" ]; then
#         echo -e "${GREEN}Creating anonymous backend state config${NC}"
#         cat > "$CONVEX_STATE_DIR/config.json" << EOF
# {"uuid":"84a46da2-4357-46f0-a41e-5e50f4307595"}
# EOF
#     fi
    
#     # Create the project-specific config
#     PROJECT_CONFIG_DIR="$CONVEX_STATE_DIR/anonymous-coderouter"
#     if [ ! -f "$PROJECT_CONFIG_DIR/config.json" ]; then
#         cat > "$PROJECT_CONFIG_DIR/config.json" << EOF
# {
#   "ports": {
#     "cloud": 3212,
#     "site": 3213
#   },
#   "backendVersion": "precompiled-2025-06-30-968c2da",
#   "adminKey": "anonymous-coderouter|01a40410e2fed0907f9c63f1c290c49290734c176d95450a731d5b542ac0ffec3e16d58bde9d16",
#   "instanceSecret": "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974"
# }
# EOF
#     fi
    
#     # Create empty database and storage directory
#     touch "$PROJECT_CONFIG_DIR/convex_local_backend.sqlite3"
#     mkdir -p "$PROJECT_CONFIG_DIR/convex_local_storage"
    
# else
#     # Regular local development setup
#     echo -e "${BLUE}Local development environment detected${NC}"
    
#     # Check if backend state already exists
#     CONVEX_STATE_DIR="$HOME/.convex/anonymous-convex-backend-state"
#     if [ -d "$CONVEX_STATE_DIR/anonymous-coderouter" ]; then
#         echo -e "${YELLOW}Convex backend state already exists${NC}"
#         # Still ensure .env.local exists
#         if [ ! -f ".env.local" ]; then
#             echo -e "${GREEN}Creating .env.local for Convex...${NC}"
#             cat > .env.local << EOF
# CONVEX_DEPLOYMENT=anonymous-coderouter
# VITE_CONVEX_URL=http://127.0.0.1:3212
# EOF
#         fi
#         exit 0
#     fi
    
#     # Create .env.local with default configuration for local development
#     echo -e "${GREEN}Creating .env.local for Convex...${NC}"
#     cat > .env.local << EOF
# CONVEX_DEPLOYMENT=anonymous-coderouter
# VITE_CONVEX_URL=http://127.0.0.1:3212
# EOF
    
#     # Also create the backend state for local development to maintain consistency
#     echo -e "${BLUE}Creating Convex backend state for local development${NC}"
#     mkdir -p "$CONVEX_STATE_DIR/anonymous-coderouter"
    
#     # Create the config.json for the anonymous backend state
#     if [ ! -f "$CONVEX_STATE_DIR/config.json" ]; then
#         cat > "$CONVEX_STATE_DIR/config.json" << EOF
# {"uuid":"84a46da2-4357-46f0-a41e-5e50f4307595"}
# EOF
#     fi
    
#     # Create the project-specific config
#     PROJECT_CONFIG_DIR="$CONVEX_STATE_DIR/anonymous-coderouter"
#     if [ ! -f "$PROJECT_CONFIG_DIR/config.json" ]; then
#         cat > "$PROJECT_CONFIG_DIR/config.json" << EOF
# {
#   "ports": {
#     "cloud": 3212,
#     "site": 3213
#   },
#   "backendVersion": "precompiled-2025-06-30-968c2da",
#   "adminKey": "anonymous-coderouter|01a40410e2fed0907f9c63f1c290c49290734c176d95450a731d5b542ac0ffec3e16d58bde9d16",
#   "instanceSecret": "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974"
# }
# EOF
#     fi
    
#     # Create empty database and storage directory
#     touch "$PROJECT_CONFIG_DIR/convex_local_backend.sqlite3"
#     mkdir -p "$PROJECT_CONFIG_DIR/convex_local_storage"
# fi

# # Add .env.local to .gitignore if not already there
# if ! grep -q "^\.env\.local$" .gitignore 2>/dev/null; then
#     echo ".env.local" >> .gitignore
# fi

# echo -e "${GREEN}✓ Convex setup completed successfully!${NC}"
# echo -e "${BLUE}Created .env.local and Convex backend state${NC}"