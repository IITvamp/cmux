# syntax=docker/dockerfile:1.7-labs

# Stage 1: Build stage
FROM ubuntu:22.04 AS builder

ARG VERSION
ARG CODE_RELEASE
ARG DOCKER_VERSION=28.3.2
ARG DOCKER_CHANNEL=stable

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    python3 \
    make \
    g++ \
    bash \
    unzip \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24.x
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g node-gyp && \
    corepack enable && \
    corepack prepare pnpm@10.13.1 --activate

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/ && \
    ln -s /usr/local/bin/bun /usr/local/bin/bunx && \
    bun --version && \
    bunx --version

# Install openvscode-server
RUN if [ -z ${CODE_RELEASE+x} ]; then \
    CODE_RELEASE=$(curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" \
      | awk '/tag_name/{print $4;exit}' FS='[""]' \
      | sed 's|^openvscode-server-v||'); \
  fi && \
  arch="$(dpkg --print-architecture)" && \
  if [ "$arch" = "amd64" ]; then \
    ARCH="x64"; \
  elif [ "$arch" = "arm64" ]; then \
    ARCH="arm64"; \
  fi && \
  mkdir -p /app/openvscode-server && \
  curl -o \
    /tmp/openvscode-server.tar.gz -L \
    "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-${ARCH}.tar.gz" && \
  tar xf \
    /tmp/openvscode-server.tar.gz -C \
    /app/openvscode-server/ --strip-components=1 && \
  rm -rf /tmp/openvscode-server.tar.gz

# Copy package files for monorepo dependency installation
WORKDIR /coderouter
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --parents apps/*/package.json packages/*/package.json scripts/package.json ./

# Install dependencies with cache (non-interactive)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store CI=1 pnpm install --frozen-lockfile

# Pre-install node-pty in the target location
RUN mkdir -p /builtins && \
    echo '{"name":"builtins","type":"module","version":"1.0.0"}' > /builtins/package.json
WORKDIR /builtins
# Install node-pty and manually build it
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store CI=1 pnpm install node-pty && \
    cd /builtins/node_modules/.pnpm/node-pty@*/node_modules/node-pty && \
    npm run rebuild || node-gyp rebuild || true

# Copy source files needed for build
WORKDIR /coderouter
# Copy shared package source
COPY packages/shared/src ./packages/shared/src

# Copy worker source and scripts
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/
COPY apps/worker/wait-for-docker.sh ./apps/worker/

# Copy VS Code extension source
COPY packages/vscode-extension/src ./packages/vscode-extension/src
COPY packages/vscode-extension/tsconfig.json ./packages/vscode-extension/
COPY packages/vscode-extension/.vscodeignore ./packages/vscode-extension/

# Build worker without bundling native modules
RUN bun build /coderouter/apps/worker/src/index.ts \
    --target node \
    --outdir /coderouter/apps/worker/build \
    --external node-pty && \
    echo "Built worker" && \
    cp -r /coderouter/apps/worker/build /builtins/build && \
    cp /coderouter/apps/worker/wait-for-docker.sh /usr/local/bin/ && \
    chmod +x /usr/local/bin/wait-for-docker.sh

# Verify bun is still working in builder
RUN bun --version && bunx --version

# Build vscode extension
WORKDIR /coderouter/packages/vscode-extension
RUN bun run package && cp coderouter-extension-0.0.1.vsix /tmp/coderouter-extension-0.0.1.vsix

# Install VS Code extensions
RUN /app/openvscode-server/bin/openvscode-server --install-extension /tmp/coderouter-extension-0.0.1.vsix && \
    rm /tmp/coderouter-extension-0.0.1.vsix

# Create VS Code user settings
RUN mkdir -p /root/.openvscode-server/data/User && \
    echo '{"workbench.startupEditor": "none"}' > /root/.openvscode-server/data/User/settings.json && \
    mkdir -p /root/.openvscode-server/data/User/profiles/default-profile && \
    echo '{"workbench.startupEditor": "none"}' > /root/.openvscode-server/data/User/profiles/default-profile/settings.json && \
    mkdir -p /root/.openvscode-server/data/Machine && \
    echo '{"workbench.startupEditor": "none"}' > /root/.openvscode-server/data/Machine/settings.json

# Stage 2: Runtime stage
FROM ubuntu:24.04 AS runtime

ARG DOCKER_VERSION=28.3.2
ARG DOCKER_CHANNEL=stable

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    python3 \
    bash \
    nano \
    net-tools \
    sudo \
    supervisor \
    iptables \
    openssl \
    pigz \
    xz-utils \
    tmux \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24.x (runtime) and enable pnpm via corepack
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && \
    corepack prepare pnpm@10.13.1 --activate

# Copy Bun from builder
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
COPY --from=builder /usr/local/bin/bunx /usr/local/bin/bunx

# Set iptables-legacy (required for Docker in Docker on Ubuntu 22.04+)
RUN update-alternatives --set iptables /usr/sbin/iptables-legacy

# Install Docker
RUN <<-'EOF'
    set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
        x86_64) dockerArch='x86_64' ;; \
        aarch64) dockerArch='aarch64' ;; \
        *) echo >&2 "error: unsupported architecture ($arch)"; exit 1 ;; \
    esac; \
    wget -O docker.tgz "https://download.docker.com/linux/static/${DOCKER_CHANNEL}/${dockerArch}/docker-${DOCKER_VERSION}.tgz"; \
    tar --extract --file docker.tgz --strip-components 1 --directory /usr/local/bin/; \
    rm docker.tgz; \
    dockerd --version; \
    docker --version
EOF

# Skip docker-init installation - ubuntu-dind doesn't have it

# Set Bun path
ENV PATH="/usr/local/bin:$PATH"

# Copy only the built artifacts and runtime dependencies from builder
COPY --from=builder /app/openvscode-server /app/openvscode-server
COPY --from=builder /root/.openvscode-server /root/.openvscode-server
COPY --from=builder /builtins /builtins
COPY --from=builder /usr/local/bin/wait-for-docker.sh /usr/local/bin/wait-for-docker.sh

# Verify bun works in runtime
RUN bun --version && bunx --version
RUN bun add -g @openai/codex @anthropic-ai/claude-code @google/gemini-cli opencode-ai codebuff @devcontainers/cli @sourcegraph/amp

# Setup pnpm and install global packages
RUN SHELL=/bin/bash pnpm setup && \
    . /root/.bashrc


# Find and install claude-code.vsix from Bun cache using ripgrep
RUN claude_vsix=$(rg --files /root/.bun/install/cache/@anthropic-ai 2>/dev/null | rg "claude-code\.vsix$" | head -1) && \
    if [ -n "$claude_vsix" ]; then \
        echo "Found claude-code.vsix at: $claude_vsix" && \
        /app/openvscode-server/bin/openvscode-server --install-extension "$claude_vsix"; \
    else \
        echo "Warning: claude-code.vsix not found in Bun cache" && \
        exit 1; \
    fi

# Create modprobe script (required for DinD)
RUN <<-'EOF'
cat > /usr/local/bin/modprobe << 'SCRIPT'
#!/bin/sh
set -eu
# "modprobe" without modprobe
for module; do
    if [ "${module#-}" = "$module" ]; then
        ip link show "$module" || true
        lsmod | grep "$module" || true
    fi
done
# remove /usr/local/... from PATH so we can exec the real modprobe as a last resort
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
exec modprobe "$@"
SCRIPT
chmod +x /usr/local/bin/modprobe
EOF

# Create workspace directory
RUN mkdir -p /workspace /root/workspace

VOLUME /var/lib/docker

# Create supervisor config for dockerd
# Based on https://github.com/cruizba/ubuntu-dind
RUN <<-'EOF'
mkdir -p /etc/supervisor/conf.d
cat > /etc/supervisor/conf.d/dockerd.conf << 'CONFIG'
[program:dockerd]
command=/usr/local/bin/dockerd
autostart=true
autorestart=true
stderr_logfile=/var/log/dockerd.err.log
stdout_logfile=/var/log/dockerd.out.log
CONFIG
EOF

# Copy startup script
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# Ports (Docker uses default ports internally)
# 39377: Worker service
# 39378: OpenVSCode server
EXPOSE 39377 39378

WORKDIR /

ENTRYPOINT ["/startup.sh"]
CMD []