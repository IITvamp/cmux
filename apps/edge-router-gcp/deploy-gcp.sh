#!/bin/bash

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="us-central1"
ZONE="us-central1-a"
VM_NAME="edge-router"
MACHINE_TYPE="e2-micro"  # Change to e2-small, e2-medium, etc. as needed
IMAGE_FAMILY="cos-stable"  # Container-Optimized OS
IMAGE_PROJECT="cos-cloud"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required environment variables are set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable is not set${NC}"
    echo "Please run: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

echo -e "${GREEN}Starting deployment to GCP...${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Zone: $ZONE"
echo "VM Name: $VM_NAME"

# Set the project
echo -e "${YELLOW}Setting GCP project...${NC}"
gcloud config set project "$PROJECT_ID"

# Build and push Docker image to Google Container Registry
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t gcr.io/${PROJECT_ID}/edge-router:latest .

echo -e "${YELLOW}Pushing Docker image to GCR...${NC}"
docker push gcr.io/${PROJECT_ID}/edge-router:latest

# Check if VM already exists
if gcloud compute instances describe "$VM_NAME" --zone="$ZONE" &>/dev/null; then
    echo -e "${YELLOW}VM already exists. Updating...${NC}"

    # Stop the VM
    gcloud compute instances stop "$VM_NAME" --zone="$ZONE"

    # Delete the VM
    gcloud compute instances delete "$VM_NAME" --zone="$ZONE" --quiet
fi

# Create the VM with container
echo -e "${YELLOW}Creating new VM instance...${NC}"
gcloud compute instances create-with-container "$VM_NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="$IMAGE_PROJECT" \
    --container-image="gcr.io/${PROJECT_ID}/edge-router:latest" \
    --container-restart-policy=always \
    --container-env=NODE_ENV=production,PORT=8080 \
    --tags=http-server,https-server \
    --boot-disk-size=10GB \
    --boot-disk-type=pd-standard \
    --scopes=https://www.googleapis.com/auth/cloud-platform

# Create firewall rules if they don't exist
echo -e "${YELLOW}Checking firewall rules...${NC}"
if ! gcloud compute firewall-rules describe allow-edge-router-http &>/dev/null; then
    echo -e "${YELLOW}Creating HTTP firewall rule...${NC}"
    gcloud compute firewall-rules create allow-edge-router-http \
        --allow=tcp:80 \
        --target-tags=http-server \
        --description="Allow HTTP traffic to edge router"
fi

if ! gcloud compute firewall-rules describe allow-edge-router-https &>/dev/null; then
    echo -e "${YELLOW}Creating HTTPS firewall rule...${NC}"
    gcloud compute firewall-rules create allow-edge-router-https \
        --allow=tcp:443 \
        --target-tags=https-server \
        --description="Allow HTTPS traffic to edge router"
fi

if ! gcloud compute firewall-rules describe allow-edge-router-8080 &>/dev/null; then
    echo -e "${YELLOW}Creating port 8080 firewall rule...${NC}"
    gcloud compute firewall-rules create allow-edge-router-8080 \
        --allow=tcp:8080 \
        --target-tags=http-server \
        --description="Allow traffic on port 8080 to edge router"
fi

# Get the external IP
EXTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}VM External IP: $EXTERNAL_IP${NC}"
echo -e "${GREEN}Service URL: http://$EXTERNAL_IP:8080${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure your DNS to point cmux.sh and *.cmux.sh to $EXTERNAL_IP"
echo "2. Set up a reverse proxy (like nginx or Cloud Load Balancer) for HTTPS"
echo "3. Configure SSL/TLS certificates"
echo ""
echo -e "${YELLOW}To check logs:${NC}"
echo "gcloud compute ssh $VM_NAME --zone=$ZONE --command='sudo docker logs \$(sudo docker ps -q)'"
echo ""
echo -e "${YELLOW}To SSH into the VM:${NC}"
echo "gcloud compute ssh $VM_NAME --zone=$ZONE"
