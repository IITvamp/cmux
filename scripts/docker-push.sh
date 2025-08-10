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

# Check if we're logged in to Docker Hub by checking if we can access Docker Hub
log "Checking Docker Hub authentication..."
# Try to inspect a small public image to verify connectivity
if ! docker manifest inspect alpine:latest >/dev/null 2>&1; then
    log "WARNING: May not be authenticated to Docker Hub properly"
    log "Attempting push anyway..."
fi

# Push with retry logic for OrbStack/Docker Desktop issues
log "Pushing ${REPO}:${VERSION}..."
log "Note: Push may take a moment when all layers already exist..."

# Function to push with retries
push_image() {
    local image=$1
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Push attempt $attempt of $max_attempts for ${image}..."
        
        # Use timeout to prevent indefinite hangs
        if timeout 90 docker push ${image} 2>&1 | tee /tmp/docker-push-output.log; then
            log "Successfully pushed ${image}"
            rm -f /tmp/docker-push-output.log
            return 0
        else
            # Check if it's just a timeout with layers already existing
            if grep -q "Layer already exists" /tmp/docker-push-output.log; then
                log "All layers already exist, checking if manifest was updated..."
                sleep 2
                if docker manifest inspect ${image} >/dev/null 2>&1; then
                    log "Image ${image} is accessible on Docker Hub"
                    rm -f /tmp/docker-push-output.log
                    return 0
                fi
            fi
            
            if [ $attempt -lt $max_attempts ]; then
                log "Push failed or timed out, waiting 5 seconds before retry..."
                sleep 5
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    rm -f /tmp/docker-push-output.log
    log "ERROR: Failed to push ${image} after $max_attempts attempts"
    return 1
}

# Push the versioned image
if ! push_image ${REPO}:${VERSION}; then
    exit 1
fi

# Also push latest tag
log "Tagging and pushing latest..."
docker tag ${REPO}:${VERSION} ${REPO}:latest

if ! push_image ${REPO}:latest; then
    log "WARNING: Failed to push latest tag, but versioned tag was pushed successfully"
fi

log "Docker push completed successfully!"
log "Users can now run: docker pull ${REPO}:latest"