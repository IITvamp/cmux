#!/bin/bash
set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-YOUR_PROJECT_ID}"
REGION="us-central1"
ZONE="us-central1-a"
IMAGE_NAME="gcr.io/${PROJECT_ID}/cmux-proxy:latest"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CMUX Proxy Deployment ===${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install it first."
    exit 1
fi

# Check if PROJECT_ID is set
if [ "$PROJECT_ID" == "YOUR_PROJECT_ID" ]; then
    echo "Error: Please set GCP_PROJECT_ID environment variable"
    echo "Example: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Build Docker image
echo -e "${BLUE}Building Docker image...${NC}"
docker build -t ${IMAGE_NAME} .
echo -e "${GREEN}✓ Docker image built${NC}"

# Authenticate Docker with GCR if needed
echo -e "${BLUE}Authenticating with GCR...${NC}"
gcloud auth configure-docker --quiet
echo -e "${GREEN}✓ Authenticated${NC}"

# Push to GCR
echo -e "${BLUE}Pushing image to GCR...${NC}"
docker push ${IMAGE_NAME}
echo -e "${GREEN}✓ Image pushed${NC}"

# Check if VM exists
echo -e "${BLUE}Checking if VM exists...${NC}"
if gcloud compute instances describe cmux-proxy-vm --zone=${ZONE} &> /dev/null; then
    echo -e "${BLUE}Updating existing VM instance...${NC}"
    gcloud compute instances update-container cmux-proxy-vm \
        --zone=${ZONE} \
        --container-image=${IMAGE_NAME}
    echo -e "${GREEN}✓ VM updated${NC}"
else
    echo -e "${BLUE}Creating new VM instance...${NC}"
    gcloud compute instances create-with-container cmux-proxy-vm \
        --zone=${ZONE} \
        --machine-type=e2-medium \
        --container-image=${IMAGE_NAME} \
        --container-restart-policy=always \
        --container-env=PORT=3000,NODE_ENV=production \
        --tags=http-server,https-server \
        --scopes=https://www.googleapis.com/auth/cloud-platform
    echo -e "${GREEN}✓ VM created${NC}"

    # Create firewall rules
    echo -e "${BLUE}Creating firewall rules...${NC}"
    if ! gcloud compute firewall-rules describe allow-cmux-proxy &> /dev/null; then
        gcloud compute firewall-rules create allow-cmux-proxy \
            --allow=tcp:3000,tcp:80,tcp:443 \
            --target-tags=http-server,https-server \
            --description="Allow traffic to cmux-proxy"
        echo -e "${GREEN}✓ Firewall rules created${NC}"
    else
        echo -e "${GREEN}✓ Firewall rules already exist${NC}"
    fi
fi

# Get external IP
echo -e "${BLUE}Getting external IP...${NC}"
EXTERNAL_IP=$(gcloud compute instances describe cmux-proxy-vm --zone=${ZONE} --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
echo -e "${GREEN}✓ External IP: ${EXTERNAL_IP}${NC}"

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Server URL: http://${EXTERNAL_IP}:3000"
echo "Health check: http://${EXTERNAL_IP}:3000/health"
echo ""
echo "To view logs:"
echo "  gcloud compute ssh cmux-proxy-vm --zone=${ZONE} --command='docker logs \$(docker ps -q)'"
echo ""
echo "To SSH into VM:"
echo "  gcloud compute ssh cmux-proxy-vm --zone=${ZONE}"
