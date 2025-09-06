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
    description="CMUX snapshot builder (systemd services; Docker via official repo; Node 24)"
)
ap.add_argument(
    "--resnapshot",
    action="store_true",
    help="Start an instance, validate, then snapshot again",
)
args = ap.parse_args()


def _file_sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _apt_stack(snapshot: Snapshot) -> Snapshot:
    # Single apt layer: original base + extras + Docker (official repo) + Node 24 + gh.
    return snapshot.exec(
        r"""
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
  binutils sudo build-essential curl default-libmysqlclient-dev \
  dnsutils gettext git git-lfs gnupg inotify-tools iputils-ping jq \
  libbz2-dev libc6 libc6-dev libcurl4-openssl-dev libdb-dev libedit2 \
  libffi-dev libgdbm-compat-dev libgdbm-dev libgdiplus \
  libgssapi-krb5-2 liblzma-dev libncurses-dev libnss3-dev libpq-dev \
  libpsl-dev libpython3-dev libreadline-dev libsqlite3-dev libssl-dev \
  libunwind8 libuuid1 libxml2-dev libz3-dev make moreutils \
  netcat-openbsd openssh-client pkg-config protobuf-compiler ripgrep rsync \
  software-properties-common sqlite3 swig tk-dev tzdata unixodbc-dev unzip \
  uuid-dev wget xz-utils zip zlib1g zlib1g-dev ca-certificates bash python3 \
  procps htop python3-docker nano supervisor iptables openssl pigz tmux lsof \
  iproute2 net-tools

# Docker repo (Ubuntu/Debian)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
ARCH="$(dpkg --print-architecture)"
CODENAME="$(
  . /etc/os-release
  echo "${VERSION_CODENAME:-$UBUNTU_CODENAME}"
)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# BuildKit + IPv6 localhost
install -d -m 0755 /etc/docker
tmp="$(mktemp)"
if [ -s /etc/docker/daemon.json ]; then
  jq -s '.[0] * .[1]' /etc/docker/daemon.json <(echo '{"features":{"buildkit":true}}') > "$tmp"
else
  echo '{"features":{"buildkit":true}}' > "$tmp"
fi
mv "$tmp" /etc/docker/daemon.json
grep -q '^DOCKER_BUILDKIT=' /etc/environment || echo 'DOCKER_BUILDKIT=1' >> /etc/environment
grep -qE '^::1\s+localhost(\s|$)' /etc/hosts || echo '::1       localhost' >> /etc/hosts

# Start Docker (no dind hacks)
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable docker
  systemctl restart docker
elif command -v service >/dev/null 2>&1; then
  service docker restart
else
  echo "No init system found to manage Docker" >&2
  exit 1
fi

for i in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker info >/dev/null 2>&1
docker compose version >/dev/null 2>&1
docker buildx version >/dev/null 2>&1

# Node 24 (NodeSource installer handles codename/nodistro)
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y --no-install-recommends nodejs
node -v
npm -v
npm i -g node-gyp
corepack enable
corepack prepare pnpm@10.14.0 --activate

# GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list
apt-get update
apt-get install -y gh

apt-get clean
rm -rf /var/lib/apt/lists/*
"""
    )


def _upload_workspace(
    snapshot: Snapshot, local_zip: Path, remote_zip: str = "/root/cmux_workspace.zip"
) -> Snapshot:
    snapshot = snapshot.upload(str(local_zip), remote_zip, recursive=False)
    return snapshot.exec(
        rf"""
set -euxo pipefail
install -d -m 0755 /workspace
unzip -q -o {remote_zip} -d /workspace
"""
    )


def _devtools_build(snapshot: Snapshot) -> Snapshot:
    # Dev tools (bun, OpenVSCode), repo builds (worker/envctl/envd), extension installs.
    return snapshot.exec(
        r"""
set -euxo pipefail

# Bun
curl -fsSL https://bun.sh/install | bash
install -m 0755 /root/.bun/bin/bun /usr/local/bin/bun
ln -sf /usr/local/bin/bun /usr/local/bin/bunx
bun --version
bunx --version

# Global CLIs
bun add -g @openai/codex@0.25.0 @anthropic-ai/claude-code@1.0.83 @google/gemini-cli@0.1.21 opencode-ai@0.6.4 codebuff @devcontainers/cli @sourcegraph/amp

# Cursor CLI
curl -fsS https://cursor.com/install | bash
/root/.local/bin/cursor-agent --version

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
curl -fSL --retry 6 --retry-all-errors --connect-timeout 20 --max-time 600 -o /tmp/openvscode-server.tgz "$url"
tar -xf /tmp/openvscode-server.tgz -C /opt/openvscode-server --strip-components=1
rm -f /tmp/openvscode-server.tgz

# VS Code settings
install -d -m 0755 \
  /root/.openvscode-server/data/User \
  /root/.openvscode-server/data/User/profiles/default-profile \
  /root/.openvscode-server/data/Machine
SETTINGS='{"workbench.startupEditor":"none","terminal.integrated.macOptionClickForcesSelection":true,"terminal.integrated.defaultProfile.linux":"bash","terminal.integrated.profiles.linux":{"bash":{"path":"/bin/bash","args":["-l"]}},"git.openDiffOnClick":true,"scm.defaultViewMode":"tree","git.showPushSuccessNotification":true,"git.autorefresh":true,"git.branchCompareWith":"main"}'
echo "$SETTINGS" > /root/.openvscode-server/data/User/settings.json
echo "$SETTINGS" > /root/.openvscode-server/data/User/profiles/default-profile/settings.json
echo "$SETTINGS" > /root/.openvscode-server/data/Machine/settings.json

# Workspace builds
cd /workspace
corepack enable
corepack prepare pnpm@10.14.0 --activate

CI=1 pnpm install --frozen-lockfile=true \
  --filter "@cmux/worker..." \
  --filter "@cmux/shared..." \
  --filter "@cmux/envctl" \
  --filter "@cmux/envd" \
  --filter "cmux-vscode-extension..."

# Build worker
bun build ./apps/worker/src/index.ts \
  --target node \
  --outdir ./apps/worker/build \
  --external @cmux/convex \
  --external node:*

# Build envctl/envd
pnpm -F @cmux/envctl -F @cmux/envd build

# CLI shims
install -d -m 0755 /usr/local/lib/cmux /usr/local/bin
rm -rf /usr/local/lib/cmux/envctl /usr/local/lib/cmux/envd || true
cp -r ./packages/envctl/dist /usr/local/lib/cmux/envctl
cp -r ./packages/envd/dist   /usr/local/lib/cmux/envd
printf '#!/bin/sh\nexec node /usr/local/lib/cmux/envctl/dist/index.js "$@"\n' > /usr/local/bin/envctl
printf '#!/bin/sh\nexec node /usr/local/lib/cmux/envd/dist/index.js "$@"\n'   > /usr/local/bin/envd
chmod +x /usr/local/bin/envctl /usr/local/bin/envd

# Required configs (mirror Dockerfile COPY step)
[ -f ./configs/tmux.conf ] || { echo "Missing ./configs/tmux.conf" >&2; exit 1; }
cp ./configs/tmux.conf /etc/tmux.conf
[ -f ./configs/envctl.sh ] || { echo "Missing ./configs/envctl.sh" >&2; exit 1; }
install -m 0644 ./configs/envctl.sh /etc/profile.d/envctl.sh
printf '\n# Source envctl hook for interactive shells\nif [ -f /etc/profile.d/envctl.sh ]; then . /etc/profile.d/envctl.sh; fi\n' >> /etc/bash.bashrc
install -d -m 0755 /etc/zsh
printf '\n# Source envctl hook for interactive shells\nif [ -f /etc/profile.d/envctl.sh ]; then . /etc/profile.d/envctl.sh; fi\n' >> /etc/zsh/zshrc

# Repo utilities required
[ -f ./apps/worker/scripts/collect-relevant-diff.sh ] || { echo "Missing collect-relevant-diff.sh" >&2; exit 1; }
install -m 0755 ./apps/worker/scripts/collect-relevant-diff.sh /usr/local/bin/cmux-collect-relevant-diff.sh
[ -f ./apps/worker/wait-for-docker.sh ] || { echo "Missing wait-for-docker.sh" >&2; exit 1; }
install -m 0755 ./apps/worker/wait-for-docker.sh /usr/local/bin/wait-for-docker.sh

# Build and install our VSIX (required)
[ -f packages/vscode-extension/package.json ] || { echo "Missing packages/vscode-extension" >&2; exit 1; }
cd packages/vscode-extension
bun run package
VSIX="$(ls -1 *.vsix | head -n1)"
[ -n "$VSIX" ] || { echo "VSIX build produced no file" >&2; exit 1; }
cd /workspace
/opt/openvscode-server/bin/openvscode-server --install-extension "packages/vscode-extension/$VSIX"

# Install Claude Code VSIX from Bun cache (required)
claude_vsix=$(rg --files /root/.bun/install/cache/@anthropic-ai | rg "claude-code\.vsix$" | head -1)
[ -n "${claude_vsix:-}" ] || { echo "claude-code.vsix not found in Bun cache" >&2; exit 1; }
/opt/openvscode-server/bin/openvscode-server --install-extension "$claude_vsix"
"""
    )


def _systemd_services(snapshot: Snapshot) -> Snapshot:
    # Units must start; failures abort.
    return snapshot.exec(
        r"""
set -euxo pipefail

install -d -m 0755 /var/log/cmux /run/cmux

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
systemctl enable cmux-envd cmux-openvscode cmux-worker
systemctl restart cmux-envd cmux-openvscode cmux-worker

# Verify services
systemctl is-active --quiet cmux-envd
systemctl is-active --quiet cmux-worker

ok=0
for i in $(seq 1 30); do
  if curl -sSf "http://127.0.0.1:39378/?folder=/workspace" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  echo "OpenVSCode did not respond on :39378" >&2
  journalctl -u cmux-openvscode --no-pager -n 200 || true
  exit 1
fi
"""
    )


# --- main ---

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
    vcpus=vcpus, memory=memory, disk_size=disk_size, digest=digest
)
print(f"Snapshot created: {snapshot.id}")

print("APT stack")
snapshot = _apt_stack(snapshot)

print("Upload/unpack workspace")
snapshot = _upload_workspace(snapshot, local_zip)

print("Dev tools + builds")
snapshot = _devtools_build(snapshot)

print("Systemd services + verification")
snapshot = _systemd_services(snapshot)

print(f"Snapshot ID: {snapshot.id}")

if args.resnapshot:
    instance = client.instances.start(
        snapshot_id=snapshot.id, ttl_seconds=3600, ttl_action="pause"
    )
    try:
        for port in [39376, 39377, 39378]:
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
