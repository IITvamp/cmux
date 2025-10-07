#!/bin/bash

set -e

# Create a tmux session named "cmux" with multiple windows
SESSION_NAME="cmux"

# Check if tmux session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Tmux session '$SESSION_NAME' already exists. Attaching..."
    tmux attach-session -t "$SESSION_NAME"
    exit 0
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "Starting cmux in tmux session '$SESSION_NAME'..."

# Create new session with first window for dev.sh
tmux new-session -d -s "$SESSION_NAME" -n "dev" -c "$APP_DIR"

# Run dev.sh in the first window
tmux send-keys -t "$SESSION_NAME:dev" "bash $SCRIPT_DIR/dev.sh" C-m

# Create a second window for maintenance.sh
tmux new-window -t "$SESSION_NAME" -n "maintenance" -c "$APP_DIR"

# Run maintenance.sh in the second window
tmux send-keys -t "$SESSION_NAME:maintenance" "bash $SCRIPT_DIR/maintenance.sh" C-m

# Select the first window by default
tmux select-window -t "$SESSION_NAME:dev"

echo "Tmux session '$SESSION_NAME' created with windows: dev, maintenance"
echo "Attaching to session..."

# Attach to the session
tmux attach-session -t "$SESSION_NAME"
