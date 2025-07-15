# Base image with Docker-in-Docker
FROM docker:28.3.2-dind

# Build and runtime dependencies
RUN apk add --no-cache \
    curl python3 make g++ linux-headers bash \
    nodejs npm

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Application source
COPY . /coderouter
WORKDIR /coderouter

# Install Node deps and build the worker
RUN npm install

RUN ls /coderouter
RUN ls /coderouter/apps/worker

RUN bun build /coderouter/apps/worker/src/index.ts --target node --outdir /coderouter/apps/worker/build

# Move artefacts to runtime location
RUN mkdir -p /builtins && \
    cp -r ./apps/worker/build /builtins/build && \
    cp ./apps/worker/package.json /builtins/package.json && \
    cp ./apps/worker/wait-for-docker.sh /usr/local/bin/ && \
    chmod +x /usr/local/bin/wait-for-docker.sh

# Workspace
RUN mkdir -p /workspace
WORKDIR /builtins

# Environment
ENV NODE_ENV=production
ENV WORKER_PORT=3002
ENV MANAGEMENT_PORT=3003

# Ports
EXPOSE 2375 3002 3003

# Startup script
RUN cat > /startup.sh << 'EOF'
#!/bin/sh
dockerd-entrypoint.sh &
wait-for-docker.sh
node /builtins/build/index.js
EOF
RUN chmod +x /startup.sh

ENTRYPOINT ["/startup.sh"]
CMD []
