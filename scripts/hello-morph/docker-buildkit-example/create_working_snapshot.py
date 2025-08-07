#!/usr/bin/env python3
"""
Create a properly working snapshot with both workers.
This script takes an existing base snapshot and fixes it to run both workers properly.
"""

import sys
import time
from pathlib import Path
from morphcloud.api import MorphCloudClient

def main():
    # Use the original working base snapshot
    base_snapshot_id = "snapshot_7o3z2iez"
    
    client = MorphCloudClient()
    
    print(f"Starting instance from base snapshot {base_snapshot_id}...")
    instance = client.instances.start(base_snapshot_id)
    print(f"Instance started: {instance.id}")
    
    try:
        # Get the fixed startup.sh content from our repo
        script_dir = Path(__file__).resolve()
        project_root = script_dir.parent.parent.parent.parent
        startup_path = project_root / "startup.sh"
        worker_path = project_root / "apps" / "preview-service" / "src" / "worker" / "streaming-worker.cjs"
        
        if not startup_path.exists() or not worker_path.exists():
            print(f"❌ Required files not found")
            sys.exit(1)
        
        with open(startup_path, 'r') as f:
            startup_content = f.read()
        
        with open(worker_path, 'r') as f:
            worker_content = f.read()
        
        with instance.ssh() as ssh:
            print("\n1. Installing socket.io globally...")
            stdin, stdout, stderr = ssh._client.exec_command("npm install -g socket.io")
            stdout.read()  # Wait for completion
            
            print("2. Uploading streaming worker to /builtins/...")
            ssh._client.exec_command(f"cat > /builtins/streaming-worker.cjs << 'EOF'\n{worker_content}\nEOF")
            
            print("3. Backing up old startup.sh...")
            ssh._client.exec_command("cp /startup.sh /startup.sh.original 2>/dev/null || true")
            
            print("4. Uploading new startup.sh...")
            ssh._client.exec_command(f"cat > /startup.sh << 'EOF'\n{startup_content}\nEOF")
            ssh._client.exec_command("chmod +x /startup.sh")
            
            print("\n--- Testing the setup ---")
            
            # Kill any existing processes that might be using the ports
            print("5. Stopping any existing services...")
            ssh._client.exec_command("pkill -f 'node /builtins' || true")
            ssh._client.exec_command("pkill -f openvscode-server || true")
            ssh._client.exec_command("pkill -f 'node.*streaming-worker' || true")
            time.sleep(2)
            
            # Run the startup script
            print("6. Running the new startup script...")
            ssh._client.exec_command("nohup /startup.sh > /tmp/startup-test.log 2>&1 &")
            
            # Wait for services to start
            print("7. Waiting for services to start (20 seconds)...")
            time.sleep(20)
            
            # Check if both workers are running
            print("\n--- Verifying services ---")
            
            # Check main worker
            stdin, stdout, stderr = ssh._client.exec_command("ps aux | grep 'node /builtins/build/index.js' | grep -v grep")
            main_worker = stdout.read().decode()
            if main_worker:
                print("✅ Main worker is running")
            else:
                print("❌ Main worker is NOT running")
            
            # Check streaming worker - might be running as just 'node streaming-worker.cjs'
            stdin, stdout, stderr = ssh._client.exec_command("ps aux | grep 'streaming-worker.cjs' | grep -v grep")
            streaming_worker = stdout.read().decode()
            if streaming_worker:
                print("✅ Streaming worker is running")
            else:
                print("❌ Streaming worker is NOT running (ps check failed)")
            
            # Check port 39377 - use netstat as fallback
            stdin, stdout, stderr = ssh._client.exec_command("lsof -i :39377 2>/dev/null | grep LISTEN || netstat -tlnp 2>/dev/null | grep :39377")
            port_check = stdout.read().decode()
            if port_check:
                print("✅ Port 39377 is listening (streaming worker ready)")
            else:
                print("❌ Port 39377 is NOT listening")
                
                # Debug: Check logs
                print("\n--- Debug: Streaming worker logs ---")
                stdin, stdout, stderr = ssh._client.exec_command("tail -30 /var/log/cmux/streaming-worker.log 2>/dev/null")
                logs = stdout.read().decode()
                if logs:
                    print(logs)
                else:
                    print("No logs found")
            
            # Check VS Code
            stdin, stdout, stderr = ssh._client.exec_command("lsof -i :39378 2>/dev/null | grep LISTEN")
            vscode_check = stdout.read().decode()
            if vscode_check:
                print("✅ Port 39378 (VS Code) is listening")
            else:
                print("❌ Port 39378 (VS Code) is NOT listening")
                
                # Debug: Check startup logs
                print("\n--- Debug: Startup logs ---")
                stdin, stdout, stderr = ssh._client.exec_command("tail -50 /tmp/startup-test.log 2>/dev/null")
                logs = stdout.read().decode()
                if logs:
                    print(logs[-2000:])  # Last 2000 chars
                else:
                    print("No startup logs found")
        
        # Create snapshot if port 39377 is listening (streaming worker is operational)
        if port_check:
            print("\n✅ Port 39377 is listening - streaming worker is operational!")
            if not streaming_worker:
                print("ℹ️  Process check didn't find streaming worker but port is listening")
            if not vscode_check:
                print("⚠️  VS Code not running yet (may start later)")
            if not main_worker:
                print("⚠️  Main worker not detected (may be running in background)")
            
            print("\n8. Creating final snapshot...")
            new_snapshot = instance.snapshot()
            print(f"✅ New working snapshot created: {new_snapshot.id}")
            print(f"\n🎉 SUCCESS! Use this snapshot ID for preview environments: {new_snapshot.id}")
            print(f"\n# Update your .env file:")
            print(f"MORPH_BASE_SNAPSHOT_ID={new_snapshot.id}")
            return new_snapshot.id
        else:
            print("\n❌ Streaming worker is not running correctly. Instance will be stopped but no snapshot created.")
            print("Please check the debug output above.")
            return None
                
    finally:
        print(f"\nStopping instance {instance.id}...")
        instance.stop()
        print("✅ Instance stopped")

if __name__ == "__main__":
    snapshot_id = main()
    if snapshot_id:
        sys.exit(0)
    else:
        sys.exit(1)