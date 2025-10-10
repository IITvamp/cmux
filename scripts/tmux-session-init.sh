#!/bin/bash
# This script initializes the tmux session with dev and maintenance scripts
# running in the background, then executes the provided command

set -e

# Function to check if a script should be run
should_run_script() {
    local script_path="$1"
    local log_file="$2"

    # Check if script exists
    if [ ! -f "$script_path" ]; then
        return 1
    fi

    # Check if already running by looking for the log file's recent activity
    if [ -f "$log_file" ]; then
        # Check if log was modified in last 5 seconds (indicating it's running)
        if [ "$(find "$log_file" -mmin -0.083 2>/dev/null)" ]; then
            echo "[tmux-init] Script appears to be already running (recent log activity)" >&2
            return 1
        fi
    fi

    return 0
}

# Function to start dev.sh in background if not already running
start_dev_if_needed() {
    local dev_script="/root/workspace/scripts/dev.sh"
    local dev_log="/var/log/cmux/dev.log"

    if should_run_script "$dev_script" "$dev_log"; then
        echo "[tmux-init] Starting dev.sh in background..." >&2
        mkdir -p /var/log/cmux

        # Start dev.sh with appropriate flags for container environment
        (cd /root/workspace && \
         SKIP_DOCKER_BUILD=true \
         SKIP_CONVEX=true \
         nohup ./scripts/dev.sh >> "$dev_log" 2>&1 &) || true

        echo "[tmux-init] dev.sh started (pid: $!, log: $dev_log)" >&2

        # Give it a moment to start
        sleep 2
    else
        echo "[tmux-init] dev.sh not found or already running" >&2
    fi
}

# Function to start maintenance.sh in background if needed
start_maintenance_if_needed() {
    local maint_script="/root/workspace/scripts/maintenance.sh"
    local maint_log="/var/log/cmux/maintenance.log"

    # Maintenance should only run once per session
    local maint_marker="/var/run/cmux-maintenance-done"

    if [ -f "$maint_marker" ]; then
        echo "[tmux-init] Maintenance already completed in this session" >&2
        return
    fi

    if should_run_script "$maint_script" "$maint_log"; then
        echo "[tmux-init] Starting maintenance.sh in background..." >&2
        mkdir -p /var/log/cmux

        # Start maintenance.sh
        (cd /root/workspace && \
         nohup ./scripts/maintenance.sh >> "$maint_log" 2>&1 && \
         touch "$maint_marker" &) || true

        echo "[tmux-init] maintenance.sh started (log: $maint_log)" >&2

        # Maintenance needs more time
        sleep 3
    else
        echo "[tmux-init] maintenance.sh not found" >&2
    fi
}

# Main execution
echo "[tmux-init] Initializing tmux session environment..." >&2

# Check if we should start background scripts
# Only run these if we're in the container environment
if [ -d "/root/workspace" ]; then
    # Start maintenance first (builds, installs deps)
    start_maintenance_if_needed

    # Then start dev servers
    start_dev_if_needed
fi

# Now execute the actual command passed to this script
echo "[tmux-init] Executing main command: $@" >&2
exec "$@"