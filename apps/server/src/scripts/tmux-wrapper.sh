#!/bin/bash
set -e

# This script runs maintenance and dev scripts before starting the agent in tmux
# It's designed to be run as the main command for a tmux session

# Log directory
LOG_DIR="/var/log/cmux"
mkdir -p "$LOG_DIR"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_DIR/tmux-wrapper.log"
}

log_message "Starting tmux wrapper script"

# Check for environment variables containing scripts
if [ -n "$CMUX_MAINTENANCE_SCRIPT" ]; then
    log_message "Running maintenance script..."
    echo "[Maintenance] Running maintenance script..."

    # Create a temporary file for the maintenance script
    MAINTENANCE_SCRIPT_FILE="/tmp/cmux-maintenance-$$.sh"
    echo "$CMUX_MAINTENANCE_SCRIPT" > "$MAINTENANCE_SCRIPT_FILE"
    chmod +x "$MAINTENANCE_SCRIPT_FILE"

    # Run the maintenance script
    if bash "$MAINTENANCE_SCRIPT_FILE" >> "$LOG_DIR/maintenance.log" 2>&1; then
        log_message "Maintenance script completed successfully"
        echo "[Maintenance] Completed successfully"
    else
        EXIT_CODE=$?
        log_message "Maintenance script failed with exit code $EXIT_CODE"
        echo "[Maintenance] Failed with exit code $EXIT_CODE (see $LOG_DIR/maintenance.log)"
    fi

    # Clean up
    rm -f "$MAINTENANCE_SCRIPT_FILE"
fi

if [ -n "$CMUX_DEV_SCRIPT" ]; then
    log_message "Starting dev script in background..."
    echo "[Dev] Starting development server..."

    # Create a temporary file for the dev script
    DEV_SCRIPT_FILE="/tmp/cmux-dev-$$.sh"
    echo "$CMUX_DEV_SCRIPT" > "$DEV_SCRIPT_FILE"
    chmod +x "$DEV_SCRIPT_FILE"

    # Run the dev script in background
    nohup bash "$DEV_SCRIPT_FILE" >> "$LOG_DIR/dev-script.log" 2>&1 &
    DEV_PID=$!
    echo $DEV_PID > "$LOG_DIR/dev-script.pid"

    log_message "Dev script started with PID $DEV_PID"
    echo "[Dev] Development server started (PID: $DEV_PID)"

    # Give the dev server a moment to start
    sleep 2

    # Check if it's still running
    if kill -0 $DEV_PID 2>/dev/null; then
        echo "[Dev] Development server is running"
    else
        echo "[Dev] Warning: Development server may have exited early (check $LOG_DIR/dev-script.log)"
    fi
fi

# Now execute the actual agent command
log_message "Starting agent command: $@"
echo "[Agent] Starting agent..."
echo ""  # Add a blank line for clarity

# Execute the agent command directly (exec replaces this shell)
exec "$@"