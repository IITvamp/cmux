#!/bin/bash

# Clear existing logs first
LOG_DIR="/Users/lawrencechen/Library/Application Support/@cmux/client/logs"
if [ -d "$LOG_DIR" ]; then
    echo "Clearing old logs..."
    rm -f "$LOG_DIR"/*.log
fi

# Open the app
echo "Opening cmux app..."
open /Users/lawrencechen/fun/cmux12/apps/client/dist-electron/mac-arm64/cmux.app

# Wait for app to start
echo "Waiting for app to start..."
sleep 3

# Monitor logs continuously
echo "Monitoring logs..."
while true; do
    echo "==================== $(date) ===================="
    
    # Check if logs directory exists
    if [ -d "$LOG_DIR" ]; then
        echo "Logs directory found"
        
        # List log files
        echo "Log files:"
        ls -la "$LOG_DIR"
        
        # Check renderer.log
        if [ -f "$LOG_DIR/renderer.log" ]; then
            echo ""
            echo "=== renderer.log (last 50 lines) ==="
            tail -50 "$LOG_DIR/renderer.log"
        else
            echo "renderer.log not found yet"
        fi
        
        # Check main.log
        if [ -f "$LOG_DIR/main.log" ]; then
            echo ""
            echo "=== main.log (last 50 lines) ==="
            tail -50 "$LOG_DIR/main.log"
        else
            echo "main.log not found yet"
        fi
    else
        echo "Logs directory not found yet: $LOG_DIR"
    fi
    
    echo ""
    echo "Sleeping for 5 seconds... (Press Ctrl+C to stop)"
    sleep 5
done