#!/bin/bash
set -e

# DinD setup (based on official docker:dind)
# Mount necessary filesystems
if [ -d /sys/kernel/security ] && ! mountpoint -q /sys/kernel/security; then
    mount -t securityfs none /sys/kernel/security || {
        echo >&2 'Could not mount /sys/kernel/security.'
        echo >&2 'AppArmor detection and --privileged mode might break.'
    }
fi

# cgroup v2: enable nesting
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
    mkdir -p /sys/fs/cgroup/init
    xargs -rn1 < /sys/fs/cgroup/cgroup.procs > /sys/fs/cgroup/init/cgroup.procs 2>/dev/null || :
    sed -e 's/ / +/g' -e 's/^/+/' < /sys/fs/cgroup/cgroup.controllers \
        > /sys/fs/cgroup/cgroup.subtree_control 2>/dev/null || :
fi

# Start supervisor to manage dockerd
/usr/bin/supervisord -n >> /dev/null 2>&1 &

# Wait for Docker daemon
wait-for-docker.sh

# Create log directory
mkdir -p /var/log/openvscode

# Log environment variables for debugging
echo "[Startup] Environment variables:" > /var/log/openvscode/startup.log
env >> /var/log/openvscode/startup.log

# Start OpenVSCode server on port 2376 without authentication
echo "[Startup] Starting OpenVSCode server..." >> /var/log/openvscode/startup.log
/app/openvscode-server/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 2376 \
  --without-connection-token \
  --disable-workspace-trust \
  --disable-telemetry \
  --disable-updates \
  --profile default-profile \
  --verbose \
  /root/workspace \
  > /var/log/openvscode/server.log 2>&1 &

echo "[Startup] OpenVSCode server started, logs available at /var/log/openvscode/server.log" >> /var/log/openvscode/startup.log

# Wait for OpenVSCode server to be ready
echo "[Startup] Waiting for OpenVSCode server to be ready..." >> /var/log/openvscode/startup.log
MAX_RETRIES=30
RETRY_DELAY=1
retry_count=0

while [ $retry_count -lt $MAX_RETRIES ]; do
    if curl -s -f "http://localhost:2376/?folder=/root/workspace" > /dev/null 2>&1; then
        echo "[Startup] Successfully connected to OpenVSCode server" >> /var/log/openvscode/startup.log
        break
    fi
    
    retry_count=$((retry_count + 1))
    echo "[Startup] Waiting for OpenVSCode server... (attempt $retry_count/$MAX_RETRIES)" >> /var/log/openvscode/startup.log
    sleep $RETRY_DELAY
done

if [ $retry_count -eq $MAX_RETRIES ]; then
    echo "[Startup] Warning: Failed to connect to OpenVSCode server after $MAX_RETRIES attempts" >> /var/log/openvscode/startup.log
fi

# Start the worker
export NODE_ENV=production
export WORKER_PORT=2377

rm -f /startup.sh

exec docker-init -- node /builtins/build/index.js 