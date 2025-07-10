FROM node:22-bookworm

# Install additional dependencies for node-pty and terminal support
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    zsh \
    curl \
    wget \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install bun for Convex
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/

# Create non-root user
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Add sudo support for the non-root user
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME

# Install nvm and Node versions
ENV NVM_DIR=/home/$USERNAME/.nvm
RUN mkdir -p $NVM_DIR && \
    chown -R $USER_UID:$USER_GID $NVM_DIR

# Switch to non-root user for nvm installation
USER $USERNAME

# Install nvm, Node 22 (default) and Node 18
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install 22 && \
    nvm install 18 && \
    nvm alias default 22 && \
    nvm use default

# Add nvm to shell
RUN echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc && \
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.zshrc && \
    echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> ~/.zshrc

# Set up the workspace
WORKDIR /workspace

# Install global npm packages using Node 22
RUN . "$NVM_DIR/nvm.sh" && nvm use 22 && npm install -g npm@latest

# Set up shell
ENV SHELL=/bin/zsh

# Copy and set entrypoint
COPY --chown=node:node entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/bin/zsh"]