#!/bin/bash
set -e

# Add timestamp function
log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1"
}

# Docker Hub repository
REPO="lawrencecchen/cmux"

# Get version from argument or use 'latest'
VERSION=${1:-latest}

log "Starting docker-push.sh with version: ${VERSION}"

# Build first
log "Building Docker image..."
./scripts/docker-build.sh ${VERSION}

log "Docker build complete, starting push to Docker Hub..."
log "Repository: ${REPO}"
log "Version: ${VERSION}"

# Check if Docker daemon is responsive
log "Checking Docker daemon..."
if ! docker version >/dev/null 2>&1; then
    log "ERROR: Docker daemon is not responding"
    exit 1
fi

# Check if we're logged in to Docker Hub
log "Checking Docker Hub authentication..."
if ! docker info 2>/dev/null | grep -q "Username"; then
    log "ERROR: Not logged in to Docker Hub!"
    log "Please run: docker login"
    exit 1
fi

# Simple push without timeout complications
log "Pushing ${REPO}:${VERSION}..."
docker push ${REPO}:${VERSION}
log "Successfully pushed ${REPO}:${VERSION}"

# Also push latest tag
log "Tagging and pushing latest..."
docker tag ${REPO}:${VERSION} ${REPO}:latest
docker push ${REPO}:latest
log "Successfully pushed ${REPO}:latest"

log "Docker push completed successfully!"
log "Users can now run: docker pull ${REPO}:latest"