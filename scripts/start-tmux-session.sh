#!/bin/bash

# This script starts both dev.sh and maintenance.sh in a single tmux session
# with separate windows for each script

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Change to app directory
cd "$APP_DIR"

# Session name
SESSION_NAME="cmux"

# Check if tmux session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Tmux session '$SESSION_NAME' already exists."
    # If ATTACH_TO_SESSION is set, attach to it
    if [ "${ATTACH_TO_SESSION:-false}" = "true" ]; then
        exec tmux attach-session -t "$SESSION_NAME"
    else
        echo "Session already running. Skipping."
        exit 0
    fi
fi

# Create new tmux session with first window for dev.sh
echo "Creating new tmux session '$SESSION_NAME'..."
tmux new-session -d -s "$SESSION_NAME" -n "dev" "cd $APP_DIR && ./scripts/dev.sh; bash"

# Create second window for maintenance.sh
tmux new-window -t "$SESSION_NAME" -n "maintenance" "cd $APP_DIR && ./scripts/maintenance.sh; bash"

# Select the first window (dev)
tmux select-window -t "$SESSION_NAME:0"

echo "Tmux session '$SESSION_NAME' created with windows: dev, maintenance"

# Attach to the session if requested
if [ "${ATTACH_TO_SESSION:-false}" = "true" ]; then
    exec tmux attach-session -t "$SESSION_NAME"
fi
