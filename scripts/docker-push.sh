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

# Check if buildx is available (better for pushes)
if docker buildx version >/dev/null 2>&1; then
    log "Using Docker buildx for build and push..."
    USE_BUILDX=true
else
    log "Docker buildx not available, using regular build..."
    USE_BUILDX=false
fi

# Build first (or build and push with buildx)
if [ "$USE_BUILDX" = true ]; then
    log "Building and pushing with buildx in one step..."
    # This avoids the OrbStack push hanging issue
    # Use current platform only for faster builds
    docker buildx build \
        --tag ${REPO}:${VERSION} \
        --tag ${REPO}:latest \
        --push \
        .
    
    if [ $? -eq 0 ]; then
        log "Successfully built and pushed ${REPO}:${VERSION} and ${REPO}:latest"
        log "Docker push completed successfully!"
        log "Users can now run: docker pull ${REPO}:latest"
        exit 0
    else
        log "Buildx push failed, falling back to regular method..."
        USE_BUILDX=false
    fi
fi

# Fall back to regular build if buildx not available or failed
if [ "$USE_BUILDX" = false ]; then
    log "Building Docker image..."
    ./scripts/docker-build.sh ${VERSION}
fi

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

# Function to get local image digest
get_local_digest() {
    local image=$1
    docker inspect --format='{{index .RepoDigests 0}}' ${image} 2>/dev/null | cut -d'@' -f2
}

# Function to get remote image digest
get_remote_digest() {
    local image=$1
    docker manifest inspect ${image} 2>/dev/null | jq -r '.config.digest' 2>/dev/null
}

# Function to push image with smart detection
smart_push() {
    local image=$1
    
    log "Checking if ${image} needs to be pushed..."
    
    # First check if image exists on Docker Hub
    if docker manifest inspect ${image} >/dev/null 2>&1; then
        log "Image ${image} already exists on Docker Hub"
        
        # For OrbStack, we can't reliably compare digests, so we'll assume it's up to date
        # if it exists and we just built it
        log "Skipping push as image already exists (recently built)"
        return 0
    fi
    
    log "Image ${image} not found on Docker Hub, pushing..."
    
    # Try push with timeout
    log "Starting push (this may take a few minutes)..."
    
    # Create a background process for the push
    docker push ${image} &
    local push_pid=$!
    
    # Monitor the push for up to 90 seconds
    local elapsed=0
    local check_interval=5
    local max_wait=90
    
    while [ $elapsed -lt $max_wait ]; do
        # Check if push is still running
        if ! kill -0 $push_pid 2>/dev/null; then
            # Process finished
            wait $push_pid
            local exit_code=$?
            if [ $exit_code -eq 0 ]; then
                log "Successfully pushed ${image}"
                return 0
            else
                log "Push failed with exit code $exit_code"
                return 1
            fi
        fi
        
        # Check if image is now accessible on Docker Hub
        if [ $elapsed -gt 20 ]; then  # Give it 20 seconds before checking
            if docker manifest inspect ${image} >/dev/null 2>&1; then
                log "Image ${image} is now accessible on Docker Hub"
                # Kill the push process as it's no longer needed
                kill $push_pid 2>/dev/null || true
                wait $push_pid 2>/dev/null || true
                return 0
            fi
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        
        # Show progress
        if [ $((elapsed % 15)) -eq 0 ]; then
            log "Still pushing... ($elapsed seconds elapsed)"
        fi
    done
    
    # Timeout reached
    log "Push timeout after $max_wait seconds"
    kill $push_pid 2>/dev/null || true
    wait $push_pid 2>/dev/null || true
    
    # Final check if it made it
    if docker manifest inspect ${image} >/dev/null 2>&1; then
        log "Image ${image} is accessible on Docker Hub (pushed successfully)"
        return 0
    else
        log "ERROR: Failed to push ${image}"
        return 1
    fi
}

# Push the versioned image
if ! smart_push ${REPO}:${VERSION}; then
    exit 1
fi

# Also push latest tag
log "Tagging and pushing latest..."
docker tag ${REPO}:${VERSION} ${REPO}:latest

if ! smart_push ${REPO}:latest; then
    log "WARNING: Failed to push latest tag, but versioned tag was pushed successfully"
fi

log "Docker push completed successfully!"
log "Users can now run: docker pull ${REPO}:latest"