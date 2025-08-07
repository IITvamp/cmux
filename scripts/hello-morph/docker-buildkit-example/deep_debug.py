#!/usr/bin/env python3
"""
Deep debug of the startup issue.
"""

import sys
from morphcloud.api import MorphCloudClient

def main():
    if len(sys.argv) < 2:
        print("Usage: python deep_debug.py <snapshot_id>")
        sys.exit(1)
    
    snapshot_id = sys.argv[1]
    
    client = MorphCloudClient()
    
    print(f"Starting instance from snapshot {snapshot_id}...")
    instance = client.instances.start(snapshot_id)
    print(f"Instance started: {instance.id}")
    
    try:
        with instance.ssh() as ssh:
            print("\n--- Check if OpenVSCode server exists ---")
            stdin, stdout, stderr = ssh._client.exec_command("ls -la /app/openvscode-server/bin/openvscode-server")
            print(stdout.read().decode())
            
            print("\n--- Check if worker build exists ---")
            stdin, stdout, stderr = ssh._client.exec_command("ls -la /builtins/build/index.js")
            print(stdout.read().decode())
            
            print("\n--- Check if streaming worker exists ---")
            stdin, stdout, stderr = ssh._client.exec_command("ls -la /builtins/streaming-worker.cjs")
            print(stdout.read().decode())
            
            print("\n--- Check socket.io installation ---")
            stdin, stdout, stderr = ssh._client.exec_command("npm list -g socket.io 2>&1 | head -5")
            print(stdout.read().decode())
            
            print("\n--- Try to run OpenVSCode manually ---")
            stdin, stdout, stderr = ssh._client.exec_command("""
                /app/openvscode-server/bin/openvscode-server \
                  --host 0.0.0.0 \
                  --port 39378 \
                  --without-connection-token \
                  --disable-workspace-trust \
                  --disable-telemetry \
                  --disable-updates \
                  /root/workspace > /tmp/vscode-test.log 2>&1 &
            """)
            
            ssh._client.exec_command("sleep 3")
            
            stdin, stdout, stderr = ssh._client.exec_command("lsof -i :39378 2>/dev/null | grep LISTEN")
            if stdout.read().decode():
                print("✅ OpenVSCode started successfully")
            else:
                print("❌ OpenVSCode failed to start")
                stdin, stdout, stderr = ssh._client.exec_command("tail -20 /tmp/vscode-test.log")
                print("VSCode logs:", stdout.read().decode())
            
            print("\n--- Try to run main worker manually ---")
            stdin, stdout, stderr = ssh._client.exec_command("""
                cd /builtins && \
                NODE_ENV=production IS_SANDBOX=true \
                timeout 3 node /builtins/build/index.js 2>&1
            """)
            output = stdout.read().decode()
            if output:
                print("Main worker output:", output[:500])
            
            print("\n--- Try to run streaming worker manually ---")
            stdin, stdout, stderr = ssh._client.exec_command("""
                cd /builtins && \
                WORKER_PORT=39377 \
                timeout 3 node /builtins/streaming-worker.cjs 2>&1
            """)
            output = stdout.read().decode()
            if output:
                print("Streaming worker output:", output[:500])
                
    finally:
        print(f"\nStopping instance {instance.id}...")
        instance.stop()
        print("✅ Instance stopped")

if __name__ == "__main__":
    main()