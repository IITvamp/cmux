#!/usr/bin/env python3
"""
Fix the startup script in a Morph snapshot to properly run both workers.
"""

import sys
from pathlib import Path
from morphcloud.api import MorphCloudClient

def main():
    if len(sys.argv) < 2:
        print("Usage: python fix_startup_script.py <snapshot_id>")
        sys.exit(1)
    
    snapshot_id = sys.argv[1]
    
    client = MorphCloudClient()
    
    print(f"Starting instance from snapshot {snapshot_id}...")
    instance = client.instances.start(snapshot_id)
    print(f"Instance started: {instance.id}")
    
    try:
        # Get the fixed startup.sh content from our repo
        script_dir = Path(__file__).resolve()
        project_root = script_dir.parent.parent.parent.parent
        startup_path = project_root / "startup.sh"
        
        if not startup_path.exists():
            print(f"❌ Startup file not found: {startup_path}")
            sys.exit(1)
        
        with open(startup_path, 'r') as f:
            startup_content = f.read()
        
        with instance.ssh() as ssh:
            print("Backing up old startup.sh...")
            ssh._client.exec_command("cp /startup.sh /startup.sh.old 2>/dev/null || true")
            
            print("Uploading new startup.sh...")
            # Write the new startup.sh
            ssh._client.exec_command(f"cat > /startup.sh << 'EOF'\n{startup_content}\nEOF")
            ssh._client.exec_command("chmod +x /startup.sh")
            
            print("Installing socket.io globally...")
            stdin, stdout, stderr = ssh._client.exec_command("npm install -g socket.io")
            stdout.read()  # Wait for completion
            
            print("\n--- Testing the new startup script ---")
            # Kill any existing processes
            ssh._client.exec_command("pkill -f 'node /builtins' || true")
            ssh._client.exec_command("pkill -f openvscode-server || true")
            
            # Run startup script
            print("Running startup script...")
            ssh._client.exec_command("nohup /startup.sh > /tmp/startup-test.log 2>&1 &")
            
            # Wait for services to start
            print("Waiting for services to start...")
            ssh._client.exec_command("sleep 10")
            
            # Check processes
            print("\n--- Checking processes ---")
            stdin, stdout, stderr = ssh._client.exec_command("ps aux | grep -E '(streaming-worker|index.js)' | grep -v grep")
            processes = stdout.read().decode()
            print(processes)
            
            # Check ports
            print("\n--- Checking ports ---")
            stdin, stdout, stderr = ssh._client.exec_command("lsof -i :39377 2>/dev/null | grep LISTEN")
            port_check = stdout.read().decode()
            if port_check:
                print(f"✅ Port 39377 is listening:\n{port_check}")
            else:
                print("❌ Port 39377 is not listening")
                
                # Check logs
                print("\n--- Checking streaming worker logs ---")
                stdin, stdout, stderr = ssh._client.exec_command("tail -30 /var/log/cmux/streaming-worker.log 2>/dev/null")
                logs = stdout.read().decode()
                if logs:
                    print(logs)
                else:
                    print("No streaming worker logs")
                    
                print("\n--- Checking startup logs ---")
                stdin, stdout, stderr = ssh._client.exec_command("tail -30 /tmp/startup-test.log 2>/dev/null")
                logs = stdout.read().decode()
                if logs:
                    print(logs)
            
            stdin, stdout, stderr = ssh._client.exec_command("lsof -i :39378 2>/dev/null | grep LISTEN")
            vscode_check = stdout.read().decode()
            if vscode_check:
                print(f"✅ Port 39378 (VSCode) is listening")
            else:
                print("❌ Port 39378 (VSCode) is not listening")
        
        if port_check:
            print("\n✅ Services are running correctly!")
            print("\nCreating updated snapshot...")
            new_snapshot = instance.snapshot()
            print(f"✅ New snapshot created: {new_snapshot.id}")
            print(f"\n🎉 Use this snapshot ID for preview environments: {new_snapshot.id}")
        else:
            print("\n❌ Services did not start correctly. Check the logs above.")
            print("Instance will be stopped but no new snapshot created.")
                
    finally:
        print(f"\nStopping instance {instance.id}...")
        instance.stop()
        print("✅ Instance stopped")

if __name__ == "__main__":
    main()