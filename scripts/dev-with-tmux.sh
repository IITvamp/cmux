#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Session name
SESSION_NAME="cmux-dev"

# Check if tmux session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session $SESSION_NAME already exists. Attaching..."
    exec tmux attach-session -t "$SESSION_NAME"
fi

# Create new tmux session with dev.sh in the first window
echo "Creating new tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" -n "dev" "cd $APP_DIR && ./scripts/dev.sh"

# Create a second window for maintenance.sh
tmux new-window -t "$SESSION_NAME" -n "maintenance" "cd $APP_DIR && ./scripts/maintenance.sh; echo 'Maintenance script completed. Press any key to close...'; read -n 1"

# Split the first window to create a side-by-side view (optional)
# tmux select-window -t "$SESSION_NAME:0"
# tmux split-window -h -t "$SESSION_NAME:0"

# Attach to the session
exec tmux attach-session -t "$SESSION_NAME"
