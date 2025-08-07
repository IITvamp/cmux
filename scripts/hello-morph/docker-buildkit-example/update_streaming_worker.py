#!/usr/bin/env python3
"""
Quick script to update an existing Morph snapshot with the streaming worker.
This is a faster alternative to rebuilding the entire snapshot.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from morphcloud.api import MorphCloudClient

# Load environment variables
load_dotenv()

def main():
    if len(sys.argv) < 2:
        print("Usage: python update_streaming_worker.py <snapshot_id>")
        sys.exit(1)
    
    base_snapshot_id = sys.argv[1]
    
    client = MorphCloudClient()
    
    print(f"Starting instance from snapshot {base_snapshot_id}...")
    instance = client.instances.start(base_snapshot_id)
    print(f"Instance started: {instance.id}")
    
    try:
        # Get the streaming worker content
        script_dir = Path(__file__).resolve()
        project_root = script_dir.parent.parent.parent.parent
        worker_path = project_root / "apps" / "preview-service" / "src" / "worker" / "streaming-worker.cjs"
        
        if not worker_path.exists():
            print(f"❌ Worker file not found: {worker_path}")
            sys.exit(1)
        
        with open(worker_path, 'r') as f:
            worker_content = f.read()
        
        print("Uploading streaming worker...")
        with instance.ssh() as ssh:
            # Create the worker file
            ssh._client.exec_command(f"cat > /builtins/streaming-worker.cjs << 'EOF'\n{worker_content}\nEOF")
            
            # Install socket.io globally
            print("Installing socket.io...")
            ssh._client.exec_command("npm install -g socket.io")
            
            # Update startup.sh to run both workers
            print("Updating startup script...")
            startup_update = """
# Check if startup.sh needs updating
if ! grep -q "streaming-worker.cjs" /startup.sh; then
    # Backup original
    cp /startup.sh /startup.sh.bak
    
    # Replace the worker startup section
    sed -i 's|node /builtins/build/index.js > /var/log/cmux/worker-proc.log 2>&1|# Start the main worker (background)\\nexport NODE_ENV=production\\nexport IS_SANDBOX=true\\nnode /builtins/build/index.js > /var/log/cmux/worker-proc.log 2>\\&1 \\&\\n\\n# Start the streaming worker for socket.io connections\\nexport WORKER_PORT=39377\\nnode /builtins/streaming-worker.cjs > /var/log/cmux/streaming-worker.log 2>\\&1|' /startup.sh
    
    echo "✅ Startup script updated"
else
    echo "ℹ️  Startup script already updated"
fi
"""
            ssh._client.exec_command(startup_update)
            
            # Test the streaming worker
            print("Testing streaming worker...")
            ssh._client.exec_command("cd / && WORKER_PORT=39377 timeout 2 node /builtins/streaming-worker.cjs > /tmp/test-worker.log 2>&1 &")
            
            # Check if it started
            stdin, stdout, stderr = ssh._client.exec_command("sleep 1 && lsof -i :39377 2>/dev/null | grep LISTEN")
            if stdout.read():
                print("✅ Streaming worker test successful")
            else:
                print("⚠️  Streaming worker test failed - check /tmp/test-worker.log")
            
            # Kill test worker
            ssh._client.exec_command("pkill -f streaming-worker.cjs")
        
        print("\nCreating updated snapshot...")
        new_snapshot = instance.snapshot()
        print(f"✅ New snapshot created: {new_snapshot.id}")
        print(f"\nUse this snapshot ID for preview environments: {new_snapshot.id}")
        
    finally:
        print(f"\nStopping instance {instance.id}...")
        instance.stop()
        print("✅ Instance stopped")

if __name__ == "__main__":
    main()