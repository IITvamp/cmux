#!/bin/bash
# This script runs when a client attaches to a tmux session
# It checks for and runs dev/maintenance scripts if they haven't been run yet

set -e

# Path markers to track if scripts have already run
DEV_SCRIPT_MARKER="/var/log/cmux/dev-script.started"
MAINTENANCE_SCRIPT_MARKER="/var/log/cmux/maintenance-script.completed"

# Paths to the actual scripts
WORKSPACE_DIR="/root/workspace"
DEV_SCRIPT="$WORKSPACE_DIR/scripts/dev.sh"
MAINTENANCE_SCRIPT="$WORKSPACE_DIR/scripts/maintenance.sh"

# Log function
log() {
    echo "[tmux-on-attach] $*" >> /var/log/cmux/tmux-attach.log 2>&1
}

# Create log directory if it doesn't exist
mkdir -p /var/log/cmux

log "Tmux client attached at $(date)"

# Check if dev script exists and hasn't been started yet
if [ -f "$DEV_SCRIPT" ] && [ ! -f "$DEV_SCRIPT_MARKER" ]; then
    log "Starting dev script..."
    # Run dev script in background
    (
        cd "$WORKSPACE_DIR"
        "$DEV_SCRIPT" >> /var/log/cmux/dev-script.log 2>&1 &
        echo $! > /var/log/cmux/dev-script.pid
        touch "$DEV_SCRIPT_MARKER"
        log "Dev script started with PID $(cat /var/log/cmux/dev-script.pid)"
    ) &
elif [ -f "$DEV_SCRIPT_MARKER" ]; then
    log "Dev script already started (marker exists)"
elif [ ! -f "$DEV_SCRIPT" ]; then
    log "No dev script found at $DEV_SCRIPT"
fi

# Check if maintenance script exists and hasn't been run yet
if [ -f "$MAINTENANCE_SCRIPT" ] && [ ! -f "$MAINTENANCE_SCRIPT_MARKER" ]; then
    log "Running maintenance script..."
    (
        cd "$WORKSPACE_DIR"
        if "$MAINTENANCE_SCRIPT" >> /var/log/cmux/maintenance-script.log 2>&1; then
            touch "$MAINTENANCE_SCRIPT_MARKER"
            log "Maintenance script completed successfully"
        else
            log "Maintenance script failed with exit code $?"
        fi
    ) &
elif [ -f "$MAINTENANCE_SCRIPT_MARKER" ]; then
    log "Maintenance script already completed (marker exists)"
elif [ ! -f "$MAINTENANCE_SCRIPT" ]; then
    log "No maintenance script found at $MAINTENANCE_SCRIPT"
fi

log "Tmux attach hook completed"
