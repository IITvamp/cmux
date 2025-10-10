#!/bin/bash
# Script that runs maintenance and dev scripts on first tmux attach
# This script is called by the tmux client-attached hook

set -euo pipefail

CMUX_RUNTIME_DIR="/var/tmp/cmux-scripts"
LOG_DIR="/var/log/cmux"
MARKER_FILE="$CMUX_RUNTIME_DIR/.scripts-run"
WORKSPACE_ROOT="/root/workspace"

# Create directories if they don't exist
mkdir -p "$CMUX_RUNTIME_DIR" "$LOG_DIR"

# Check if scripts have already been run
if [ -f "$MARKER_FILE" ]; then
    # Scripts already run, exit silently
    exit 0
fi

# Mark that we're running the scripts (create marker file immediately to prevent race conditions)
touch "$MARKER_FILE"

# Log script execution
echo "[$(date -Iseconds)] Running maintenance and dev scripts on tmux attach" >> "$LOG_DIR/attach-scripts.log"

# Run maintenance script if it exists
MAINTENANCE_SCRIPT="$CMUX_RUNTIME_DIR/maintenance-script.sh"
if [ -f "$MAINTENANCE_SCRIPT" ]; then
    echo "[$(date -Iseconds)] Running maintenance script..." >> "$LOG_DIR/attach-scripts.log"
    cd "$WORKSPACE_ROOT"
    if bash -eu -o pipefail "$MAINTENANCE_SCRIPT" >> "$LOG_DIR/maintenance-script.log" 2>&1; then
        echo "[$(date -Iseconds)] Maintenance script completed successfully" >> "$LOG_DIR/attach-scripts.log"
    else
        echo "[$(date -Iseconds)] ERROR: Maintenance script failed with exit code $?" >> "$LOG_DIR/attach-scripts.log"
    fi
fi

# Start dev script if it exists (runs in background continuously)
DEV_SCRIPT_PATH=$(find "$CMUX_RUNTIME_DIR" -type f -name "dev-script.sh" 2>/dev/null | head -n 1)
if [ -n "$DEV_SCRIPT_PATH" ] && [ -f "$DEV_SCRIPT_PATH" ]; then
    PID_FILE="$LOG_DIR/dev-script.pid"
    DEV_LOG="$LOG_DIR/dev-script.log"

    # Stop any existing dev script process
    if [ -f "$PID_FILE" ]; then
        EXISTING_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
            echo "[$(date -Iseconds)] Stopping existing dev script (PID: $EXISTING_PID)" >> "$LOG_DIR/attach-scripts.log"
            kill "$EXISTING_PID" 2>/dev/null || true
            sleep 0.2
        fi
    fi

    echo "[$(date -Iseconds)] Starting dev script in background..." >> "$LOG_DIR/attach-scripts.log"
    cd "$WORKSPACE_ROOT"
    nohup bash -eu -o pipefail "$DEV_SCRIPT_PATH" > "$DEV_LOG" 2>&1 &
    echo $! > "$PID_FILE"

    # Verify the dev script started
    sleep 0.5
    if kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
        echo "[$(date -Iseconds)] Dev script started successfully (PID: $(cat "$PID_FILE"))" >> "$LOG_DIR/attach-scripts.log"
    else
        echo "[$(date -Iseconds)] ERROR: Dev script failed to start" >> "$LOG_DIR/attach-scripts.log"
    fi
fi

echo "[$(date -Iseconds)] Tmux attach script execution complete" >> "$LOG_DIR/attach-scripts.log"
