# syntax=docker/dockerfile:1.7-labs
FROM ubuntu:22.04

ARG VERSION
ARG CODE_RELEASE
ARG DOCKER_VERSION=28.3.2
ARG DOCKER_CHANNEL=stable

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    python3 \
    make \
    g++ \
    bash \
    nano \
    net-tools \
    sudo \
    supervisor \
    iptables \
    openssl \
    pigz \
    xz-utils \
    unzip \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 22.x
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set iptables-legacy (required for Docker in Docker)
RUN update-alternatives --set iptables /usr/sbin/iptables-legacy && \
    update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

# Install Docker
RUN <<-'EOF'
    set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) dockerArch='x86_64' ;; \
        arm64) dockerArch='aarch64' ;; \
        *) echo >&2 "error: unsupported architecture ($arch)"; exit 1 ;; \
    esac; \
    wget -O docker.tgz "https://download.docker.com/linux/static/${DOCKER_CHANNEL}/${dockerArch}/docker-${DOCKER_VERSION}.tgz"; \
    tar --extract --file docker.tgz --strip-components 1 --directory /usr/local/bin/; \
    rm docker.tgz; \
    dockerd --version; \
    docker --version
EOF

# Install docker-init (tini)
RUN <<-'EOF'
    set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) tiniArch='amd64' ;; \
        arm64) tiniArch='arm64' ;; \
        *) echo >&2 "error: unsupported architecture ($arch)"; exit 1 ;; \
    esac; \
    wget -O /usr/local/bin/docker-init "https://github.com/krallin/tini/releases/download/v0.19.0/tini-${tiniArch}"; \
    chmod +x /usr/local/bin/docker-init
EOF

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install global packages early
RUN bun add -g @openai/codex @anthropic-ai/claude-code @google/gemini-cli opencode-ai codebuff @devcontainers/cli

# Install openvscode-server
RUN if [ -z ${CODE_RELEASE+x} ]; then \
    CODE_RELEASE=$(curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" \
      | awk '/tag_name/{print $4;exit}' FS='[""]' \
      | sed 's|^openvscode-server-v||'); \
  fi && \
  # Detect architecture and download appropriate version
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

# Copy package.json files for monorepo dependency installation
WORKDIR /coderouter
COPY --parents **/package.json .npmrc package-lock.json .
RUN --mount=type=cache,target=/root/.npm npm i

# Pre-install node-pty in the target location with cache
RUN mkdir -p /builtins && \
    cp /coderouter/apps/worker/package.json /builtins/package.json
WORKDIR /builtins
RUN --mount=type=cache,target=/root/.npm npm install node-pty

WORKDIR /coderouter
COPY . .

# Build without bundling native modules
RUN bun build /coderouter/apps/worker/src/index.ts \
    --target node \
    --outdir /coderouter/apps/worker/build \
    --external node-pty && \
    echo "Built worker" && \
    cp -r /coderouter/apps/worker/build /builtins/build && \
    cp /coderouter/apps/worker/wait-for-docker.sh /usr/local/bin/ && \
    chmod +x /usr/local/bin/wait-for-docker.sh

# Workspace
RUN mkdir -p /workspace

WORKDIR /coderouter/packages/vscode-extension
# Build vscode extension
RUN bun run package && cp coderouter-extension-0.0.1.vsix /tmp/coderouter-extension-0.0.1.vsix

# Install VS Code extensions
# COPY packages/vscode-extension/coderouter-extension-0.0.1.vsix /tmp/
RUN /app/openvscode-server/bin/openvscode-server --install-extension /tmp/coderouter-extension-0.0.1.vsix && \
    /app/openvscode-server/bin/openvscode-server --install-extension vscode.git && \
    /app/openvscode-server/bin/openvscode-server --install-extension vscode.github && \
    rm /tmp/coderouter-extension-0.0.1.vsix

# Create VS Code user settings
RUN mkdir -p /root/.openvscode-server/data/User && \
    echo '{"workbench.startupEditor": "none"}' > /root/.openvscode-server/data/User/settings.json && \
    mkdir -p /root/.openvscode-server/data/User/profiles/default-profile && \
    echo '{"workbench.startupEditor": "none"}' > /root/.openvscode-server/data/User/profiles/default-profile/settings.json && \
    mkdir -p /root/.openvscode-server/data/Machine && \
    echo '{"workbench.startupEditor": "none"}' > /root/.openvscode-server/data/Machine/settings.json

WORKDIR /

# Docker-in-Docker environment
ENV container=docker
ENV DOCKER_TLS_CERTDIR=""

# Create supervisor config for dockerd
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

# Volume for docker storage
# VOLUME /var/lib/docker

# Ports
EXPOSE 2375 2376 3002 3003 3004

ENTRYPOINT ["/startup.sh"]
# ENTRYPOINT ["sleep", "infinity"]
CMD []
