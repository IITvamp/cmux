#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Session name
SESSION_NAME="cmux-dev"

# Check if tmux session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Tmux session '$SESSION_NAME' already exists. Attaching..."
    exec tmux attach-session -t "$SESSION_NAME"
fi

# Create a new tmux session with dev.sh
echo "Creating new tmux session '$SESSION_NAME' with dev and maintenance windows..."

# Start tmux session with dev.sh in the first window
tmux new-session -d -s "$SESSION_NAME" -n "dev" -c "$APP_DIR" "bash $SCRIPT_DIR/dev.sh"

# Create a second window for maintenance.sh (not auto-running, just ready to use)
tmux new-window -t "$SESSION_NAME" -n "maintenance" -c "$APP_DIR" "bash"

# Send a message to the maintenance window with instructions
tmux send-keys -t "$SESSION_NAME:maintenance" "# Run './scripts/maintenance.sh' to clean and rebuild" C-m
tmux send-keys -t "$SESSION_NAME:maintenance" "# This window is ready for maintenance tasks" C-m

# Select the dev window as the default
tmux select-window -t "$SESSION_NAME:dev"

# Attach to the session
echo "Attaching to tmux session '$SESSION_NAME'..."
exec tmux attach-session -t "$SESSION_NAME"
