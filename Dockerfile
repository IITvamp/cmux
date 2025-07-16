# Base image with Docker-in-Docker
FROM docker:28.3.2-dind

# set version label
ARG VERSION
ARG CODE_RELEASE

# Build and runtime dependencies
RUN apk add --no-cache \
    curl python3 make g++ linux-headers bash \
    nodejs npm git libstdc++ nano net-tools sudo \
    gcompat libgcc

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install openvscode-server
RUN if [ -z ${CODE_RELEASE+x} ]; then \
    CODE_RELEASE=$(curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" \
      | awk '/tag_name/{print $4;exit}' FS='[""]' \
      | sed 's|^openvscode-server-v||'); \
  fi && \
  mkdir -p /app/openvscode-server && \
  curl -o \
    /tmp/openvscode-server.tar.gz -L \
    "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${CODE_RELEASE}/openvscode-server-v${CODE_RELEASE}-linux-arm64.tar.gz" && \
  tar xf \
    /tmp/openvscode-server.tar.gz -C \
    /app/openvscode-server/ --strip-components=1 && \
  rm -rf /tmp/openvscode-server.tar.gz && \
  # Create symlinks for glibc compatibility
  mkdir -p /lib64 && \
  ln -sf /lib/libc.musl-x86_64.so.1 /lib64/ld-linux-x86-64.so.2

# Application source
COPY . /coderouter
WORKDIR /coderouter

# Install Node deps and build the worker
RUN npm install

# Build without bundling native modules
# We exclude node-pty because it contains platform-specific compiled C++ code.
# The .node file compiled on the host (e.g., macOS ARM64) won't work in the 
# container (Linux AMD64). By marking it as external, we can install it 
# separately inside the container for the correct architecture.
RUN bun build /coderouter/apps/worker/src/index.ts --target node --outdir /coderouter/apps/worker/build --external node-pty

# Move artefacts to runtime location
RUN mkdir -p /builtins && \
    cp -r ./apps/worker/build /builtins/build && \
    cp ./apps/worker/package.json /builtins/package.json && \
    cp ./apps/worker/wait-for-docker.sh /usr/local/bin/ && \
    chmod +x /usr/local/bin/wait-for-docker.sh

# Workspace
RUN mkdir -p /workspace
WORKDIR /builtins

# Install node-pty natively in the container
# This ensures the native module is compiled for the container's architecture
# (linux/amd64) rather than the build host's architecture
RUN npm install node-pty
RUN npm install -g @openai/codex @anthropic-ai/claude-code @google/gemini-cli opencode-ai codebuff @devcontainers/cli

# Environment
ENV NODE_ENV=production
ENV WORKER_PORT=3002
ENV MANAGEMENT_PORT=3003

# Ports
EXPOSE 2375 2376 3002 3003

# Startup script
RUN cat > /startup.sh << 'EOF'
#!/bin/sh
dockerd-entrypoint.sh &
wait-for-docker.sh
# Start OpenVSCode server on port 2376
/app/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 2376 &
node /builtins/build/index.js
EOF
RUN chmod +x /startup.sh

ENTRYPOINT ["/startup.sh"]
CMD []
