#!/usr/bin/env python3
"""
Debug a Morph snapshot to check worker setup.
"""

import sys
from morphcloud.api import MorphCloudClient

def main():
    if len(sys.argv) < 2:
        print("Usage: python debug_snapshot.py <snapshot_id>")
        sys.exit(1)
    
    snapshot_id = sys.argv[1]
    
    client = MorphCloudClient()
    
    print(f"Starting instance from snapshot {snapshot_id}...")
    instance = client.instances.start(snapshot_id)
    print(f"Instance started: {instance.id}")
    
    try:
        with instance.ssh() as ssh:
            print("\n--- Checking worker files ---")
            stdin, stdout, stderr = ssh._client.exec_command("ls -la /builtins/")
            print(stdout.read().decode())
            
            print("\n--- Checking startup.sh ---")
            stdin, stdout, stderr = ssh._client.exec_command("grep -A5 -B5 'worker' /startup.sh")
            print(stdout.read().decode())
            
            print("\n--- Running startup.sh manually ---")
            stdin, stdout, stderr = ssh._client.exec_command("/startup.sh > /tmp/manual-startup.log 2>&1 &")
            
            print("\n--- Waiting for services to start ---")
            stdin, stdout, stderr = ssh._client.exec_command("sleep 5")
            
            print("\n--- Checking processes ---")
            stdin, stdout, stderr = ssh._client.exec_command("ps aux | grep -E '(streaming-worker|index.js)' | grep -v grep")
            print(stdout.read().decode())
            
            print("\n--- Checking port 39377 ---")
            stdin, stdout, stderr = ssh._client.exec_command("lsof -i :39377 2>/dev/null")
            result = stdout.read().decode()
            if result:
                print(result)
                print("✅ Port 39377 is listening")
            else:
                print("❌ Port 39377 is not listening")
            
            print("\n--- Checking logs ---")
            stdin, stdout, stderr = ssh._client.exec_command("tail -20 /var/log/cmux/streaming-worker.log 2>/dev/null")
            logs = stdout.read().decode()
            if logs:
                print("Streaming worker logs:")
                print(logs)
            else:
                print("No streaming worker logs found")
            
            stdin, stdout, stderr = ssh._client.exec_command("tail -20 /tmp/manual-startup.log 2>/dev/null")
            logs = stdout.read().decode()
            if logs:
                print("\nStartup logs:")
                print(logs)
            
            print("\n--- Test worker file directly ---")
            stdin, stdout, stderr = ssh._client.exec_command("cd / && WORKER_PORT=39377 timeout 2 node /builtins/streaming-worker.cjs 2>&1")
            output = stdout.read().decode()
            errors = stderr.read().decode()
            if output:
                print("Worker output:", output)
            if errors:
                print("Worker errors:", errors)
                
    finally:
        print(f"\nStopping instance {instance.id}...")
        instance.stop()
        print("✅ Instance stopped")

if __name__ == "__main__":
    main()