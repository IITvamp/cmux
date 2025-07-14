FROM docker:28.3.2-dind

# Install curl for socket polling, Node.js, and unzip
RUN apk add --no-cache curl nodejs npm unzip

# Install devcontainer CLI globally
RUN npm install -g @devcontainers/cli

# Copy wait-for-docker script
COPY wait-for-docker.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/wait-for-docker.sh

ENTRYPOINT ["dockerd-entrypoint.sh"]
CMD []
