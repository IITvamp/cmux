#!/bin/bash
set -e

# Docker Hub repository
REPO="lawrencecchen/cmux"

# Get version from package.json or use 'latest'
VERSION=${1:-latest}

# Build for current platform first (faster for testing)
echo "Building Docker image for current platform..."
docker build -t ${REPO}:${VERSION} -t ${REPO}:latest .

echo "Build complete!"
echo "To push: ./scripts/docker-push.sh ${VERSION}"