# /// script
# dependencies = ["morphcloud","python-dotenv"]
# ///

from __future__ import annotations

import argparse
import hashlib
import tempfile
import time
from pathlib import Path

import dotenv
from morphcloud.api import MorphCloudClient, Snapshot  # type: ignore
from zip_utils import zip_repo_fast

ap = argparse.ArgumentParser(
    description="CMUX snapshot builder (systemd-managed services)"
)
ap.add_argument(
    "--resnapshot",
    action="store_true",
    help="After starting the instance, wait for Enter and snapshot again",
)
args = ap.parse_args()


def _file_sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _apt_and_repos(snapshot: Snapshot) -> Snapshot:
    # Keep all apt actions in one layer: base toolchain + Docker + Node.js repo + installs.
    return snapshot.exec(
        r"""
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
  bash ca-certificates curl wget gnupg jq ripgrep unzip xz-utils \
  git iproute2 net-tools rsync procps lsof tzdata \
  python3 python3-pip build-essential pkg-config

# Docker APT repo
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg" \
 | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
ARCH="$(dpkg --print-architecture)"
CODENAME="$(
  . /etc/os-release
  echo "${VERSION_CODENAME:-$UBUNTU_CODENAME}"
)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

# NodeSource APT repo for Node.js 24.x
install -m 0755 -d /usr/share/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
 | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
N_CODENAME="$(
  . /etc/os-release
  echo "${VERSION_CODENAME:-nodistro}"
)"
echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x ${N_CODENAME} main" \
  > /etc/apt/sources.list.d/nodesource.list

apt-get update
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin \
  nodejs

apt-get clean
rm -rf /var/lib/apt/lists/*
"""
    )


def _docker_config_and_devstack(snapshot: Snapshot) -> Snapshot:
    # Non-apt layer: configure Docker (BuildKit), install bun + OpenVSCode, seed VSCode settings.
    return snapshot.exec(
        r"""
set -euxo pipefail

# Docker BuildKit daemon + env
install -d -m 0755 /etc/docker
tmp="$(mktemp)"
if [ -s /etc/docker/daemon.json ]; then
  jq -s '.[0] * .[1]' /etc/docker/daemon.json <(echo '{"features":{"buildkit":true}}') > "$tmp"
else
  echo '{"features":{"buildkit":true}}' > "$tmp"
fi
mv "$tmp" /etc/docker/daemon.json
grep -q '^DOCKER_BUILDKIT=' /etc/environment || echo 'DOCKER_BUILDKIT=1' >> /etc/environment

# Ensure IPv6 localhost line (idempotent)
grep -qE '^::1\s+localhost(\s|$)' /etc/hosts || echo '::1       localhost' >> /etc/hosts

# Start+enable Docker, wait until ready
systemctl enable --now docker || true
for i in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    echo 'Docker ready'
    break
  fi
  echo 'Waiting for Docker...'
  sleep 2
done
docker info >/dev/null 2>&1 || { echo 'Docker failed to start' >&2; exit 1; }

# Corepack/pnpm
corepack enable || true
corepack prepare pnpm@10.14.0 --activate || true

# Bun
curl -fsSL https://bun.sh/install | bash
install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun
ln -sf /usr/local/bin/bun /usr/local/bin/bunx
bun --version
bunx --version

# OpenVSCode Server
CODE_RELEASE="$(
  curl -sS https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest \
  | jq -r '.tag_name' | sed 's/^openvscode-server-v//'
)"
arch="$(dpkg --print-architecture)"
case "$arch" in
  amd64) ARCH="x64" ;;
  arm64) ARCH="arm64" ;;
  *) echo "Unsupported arch: $arch" >&2; exit 1 ;;
esac
install -d -m 0755 /opt/openvscode-server
url="https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-${ARCH}.tar.gz"
echo "Downloading OpenVSCode: $url"
( curl -fSL --retry 6 --retry-all-errors --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tgz "$url" \
  || curl -fSL4 --retry 6 --retry-all-errors --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tgz "$url" )
tar -xf /tmp/openvscode-server.tgz -C /opt/openvscode-server --strip-components=1
rm -f /tmp/openvscode-server.tgz

# Minimal VS Code settings
install -d -m 0755 \
  /root/.openvscode-server/data/User \
  /root/.openvscode-server/data/User/profiles/default-profile \
  /root/.openvscode-server/data/Machine
cat > /root/.openvscode-server/data/User/settings.json <<'JSON'
{"workbench.startupEditor":"none","terminal.integrated.macOptionClickForcesSelection":true,"terminal.integrated.defaultProfile.linux":"bash","terminal.integrated.profiles.linux":{"bash":{"path":"/bin/bash","args":["-l"]}}}
JSON
cp /root/.openvscode-server/data/User/settings.json /root/.openvscode-server/data/User/profiles/default-profile/settings.json
cp /root/.openvscode-server/data/User/settings.json /root/.openvscode-server/data/Machine/settings.json
"""
    )


def _unpack_build_install(snapshot: Snapshot, remote_zip: str) -> Snapshot:
    # Unzip workspace, install filtered deps, build pieces we actually run, install envctl/envd + extension.
    return snapshot.exec(
        rf"""
set -euxo pipefail

install -d -m 0755 /workspace
unzip -q -o {remote_zip} -d /workspace

cd /workspace

# Ensure pnpm is available in non-login shells
corepack enable || true
corepack prepare pnpm@10.14.0 --activate || true

# Install only what's needed for worker/shared/envctl/envd/extension
CI=1 pnpm install --frozen-lockfile=true \
  --filter "@cmux/worker..." \
  --filter "@cmux/shared..." \
  --filter "@cmux/envctl" \
  --filter "@cmux/envd" \
  --filter "cmux-vscode-extension..."

# Build worker (bundled)
bun build ./apps/worker/src/index.ts \
  --target node \
  --outdir ./apps/worker/build \
  --external @cmux/convex \
  --external node:*

# Build envctl/envd
pnpm -F @cmux/envctl -F @cmux/envd build

# Install envctl/envd into /usr/local with tiny shims
install -d -m 0755 /usr/local/lib/cmux /usr/local/bin
rm -rf /usr/local/lib/cmux/envctl /usr/local/lib/cmux/envd || true
cp -r ./packages/envctl/dist /usr/local/lib/cmux/envctl
cp -r ./packages/envd/dist   /usr/local/lib/cmux/envd
printf '#!/bin/sh\nexec node /usr/local/lib/cmux/envctl/dist/index.js "$@"\n' > /usr/local/bin/envctl
printf '#!/bin/sh\nexec node /usr/local/lib/cmux/envd/dist/index.js "$@"\n'   > /usr/local/bin/envd
chmod +x /usr/local/bin/envctl /usr/local/bin/envd

# Package and install our VS Code extension if present (best-effort)
if [ -f packages/vscode-extension/package.json ]; then
  (cd packages/vscode-extension && bun run package || true)
  VSIX="$(ls -1 packages/vscode-extension/*.vsix 2>/dev/null | head -n1 || true)"
  if [ -n "$VSIX" ]; then
    /opt/openvscode-server/bin/openvscode-server --install-extension "$VSIX" || true
  fi
fi
"""
    )


def _systemd_enable_services(snapshot: Snapshot) -> Snapshot:
    # Systemd units for VS Code, envd, and worker. Start them and verify HTTP on 39378.
    return snapshot.exec(
        r"""
set -euxo pipefail

install -d -m 0755 /var/log/cmux /run/cmux

# Baseline env for services
grep -q '^NODE_ENV=' /etc/environment       || echo 'NODE_ENV=production' >> /etc/environment
grep -q '^WORKER_PORT=' /etc/environment    || echo 'WORKER_PORT=39377'   >> /etc/environment
grep -q '^IS_SANDBOX=' /etc/environment     || echo 'IS_SANDBOX=true'     >> /etc/environment
grep -q '^DOCKER_BUILDKIT=' /etc/environment || echo 'DOCKER_BUILDKIT=1'  >> /etc/environment

cat > /etc/systemd/system/cmux-openvscode.service <<'UNIT'
[Unit]
Description=OpenVSCode Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment="XDG_RUNTIME_DIR=/run/cmux"
WorkingDirectory=/workspace
ExecStartPre=/usr/bin/mkdir -p /run/cmux /var/log/cmux
ExecStart=/opt/openvscode-server/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 39378 \
  --without-connection-token \
  --disable-workspace-trust \
  --disable-telemetry \
  --disable-updates \
  --profile default-profile \
  /workspace
Restart=on-failure
RestartSec=2s
StandardOutput=append:/var/log/cmux/openvscode.log
StandardError=append:/var/log/cmux/openvscode.err

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/cmux-envd.service <<'UNIT'
[Unit]
Description=CMUX envd
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment="XDG_RUNTIME_DIR=/run/cmux"
ExecStart=/usr/bin/env node /usr/local/lib/cmux/envd/dist/index.js
Restart=on-failure
RestartSec=2s
StandardOutput=append:/var/log/cmux/envd.log
StandardError=append:/var/log/cmux/envd.err

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/cmux-worker.service <<'UNIT'
[Unit]
Description=CMUX Worker
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=simple
Environment=NODE_ENV=production
Environment=WORKER_PORT=39377
Environment=IS_SANDBOX=true
Environment=DOCKER_BUILDKIT=1
WorkingDirectory=/workspace
ExecStart=/usr/bin/env node /workspace/apps/worker/build/index.js
Restart=on-failure
RestartSec=2s
StandardOutput=append:/var/log/cmux/worker.log
StandardError=append:/var/log/cmux/worker.err

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now cmux-envd cmux-openvscode cmux-worker || true

# Verify OpenVSCode HTTP
for i in $(seq 1 30); do
  if curl -sSf "http://127.0.0.1:39378/?folder=/workspace" >/dev/null 2>&1; then
    echo "OpenVSCode server responded"
    break
  fi
  sleep 1
done
systemctl is-active --quiet cmux-openvscode || (journalctl -u cmux-openvscode --no-pager -n 200; exit 1)
"""
    )


# --- main flow ---

THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parent.parent
local_zip = Path(tempfile.gettempdir()) / "cmux_workspace.zip"

print(f"Zipping repository to {local_zip}")
_t0 = time.perf_counter()
zip_repo_fast(REPO_ROOT, local_zip)
_t1 = time.perf_counter()
print(f"Zipped repository to {local_zip}")
print(f"Zip duration: {(_t1 - _t0):.3f}s")

vcpus = 8
memory = 16384
disk_size = 32768
digest_prefix = "cmux"

zip_hash = _file_sha256_hex(local_zip)
digest = f"{digest_prefix}_{vcpus}_{memory}_{disk_size}_{zip_hash[:16]}"

dotenv.load_dotenv()
client = MorphCloudClient()

print(f"Creating snapshot with digest: {digest}")
snapshot = client.snapshots.create(
    vcpus=vcpus,
    memory=memory,
    disk_size=disk_size,
    digest=digest,
)
print(f"Snapshot created: {snapshot.id}")

print("Provisioning base + Docker + Node (APT layer)")
snapshot = _apt_and_repos(snapshot)

print("Configuring Docker + installing Bun/OpenVSCode (non-APT layer)")
snapshot = _docker_config_and_devstack(snapshot)

# Upload and build
remote_zip = "/root/cmux_workspace.zip"
snapshot = snapshot.upload(str(local_zip), remote_zip, recursive=False)
print("Uploaded zip to snapshot")

print("Unpacking workspace and building minimal artifacts")
snapshot = _unpack_build_install(snapshot, remote_zip)

print("Enabling systemd units and verifying VS Code")
snapshot = _systemd_enable_services(snapshot)

print(f"Snapshot ID: {snapshot.id}")

if args.resnapshot:
    instance = client.instances.start(
        snapshot_id=snapshot.id,
        ttl_seconds=3600,
        ttl_action="pause",
    )
    try:
        expose_ports = [39376, 39377, 39378]
        for port in expose_ports:
            instance.expose_http_service(port=port, name=f"port-{port}")

        instance.wait_until_ready()

        services = getattr(instance.networking, "http_services", []) or []

        def _get(obj, key):
            if isinstance(obj, dict):
                return obj.get(key)
            return getattr(obj, key, None)

        vscode_service = None
        for svc in services:
            port = _get(svc, "port")
            name = _get(svc, "name")
            if port == 39378 or name == "port-39378":
                vscode_service = svc
                break

        url = _get(vscode_service, "url") if vscode_service is not None else None
        if url:
            print(f"VSCode URL: {url}/?folder=/workspace")
        else:
            print("No exposed HTTP service found for port 39378")

        input("Press Enter to snapshot again...")
        final_snapshot = instance.snapshot()
        print(f"Snapshot ID: {final_snapshot.id}")
    finally:
        try:
            instance.stop()
        except Exception:
            pass
