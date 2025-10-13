#!/bin/bash
set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-YOUR_PROJECT_ID}"
REGION="us-central1"
MIN_REPLICAS="${MIN_REPLICAS:-2}"
MAX_REPLICAS="${MAX_REPLICAS:-10}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/cmux-proxy:latest"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0;33m' # No Color

echo -e "${BLUE}=== CMUX Proxy Scaling Setup ===${NC}"

# Check if PROJECT_ID is set
if [ "$PROJECT_ID" == "YOUR_PROJECT_ID" ]; then
    echo "Error: Please set GCP_PROJECT_ID environment variable"
    echo "Example: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

echo -e "${GREEN}✓ Configuration:${NC}"
echo "  Project ID: ${PROJECT_ID}"
echo "  Region: ${REGION}"
echo "  Min replicas: ${MIN_REPLICAS}"
echo "  Max replicas: ${MAX_REPLICAS}"
echo ""

# Create instance template
echo -e "${BLUE}Creating instance template...${NC}"
if gcloud compute instance-templates describe cmux-proxy-template &> /dev/null; then
    echo "  Template already exists, deleting old one..."
    gcloud compute instance-templates delete cmux-proxy-template --quiet
fi

gcloud compute instance-templates create-with-container cmux-proxy-template \
    --container-image=${IMAGE_NAME} \
    --machine-type=e2-medium \
    --region=${REGION} \
    --container-restart-policy=always \
    --container-env=PORT=3000,NODE_ENV=production \
    --tags=http-server,https-server \
    --scopes=https://www.googleapis.com/auth/cloud-platform

echo -e "${GREEN}✓ Instance template created${NC}"

# Create health check
echo -e "${BLUE}Creating health check...${NC}"
if ! gcloud compute health-checks describe cmux-proxy-health-check &> /dev/null; then
    gcloud compute health-checks create http cmux-proxy-health-check \
        --port=3000 \
        --request-path=/health \
        --check-interval=10s \
        --timeout=5s \
        --unhealthy-threshold=2 \
        --healthy-threshold=2
    echo -e "${GREEN}✓ Health check created${NC}"
else
    echo -e "${GREEN}✓ Health check already exists${NC}"
fi

# Create managed instance group
echo -e "${BLUE}Creating managed instance group...${NC}"
if gcloud compute instance-groups managed describe cmux-proxy-mig --region=${REGION} &> /dev/null; then
    echo "  Managed instance group already exists, updating..."
    gcloud compute instance-groups managed set-instance-template cmux-proxy-mig \
        --template=cmux-proxy-template \
        --region=${REGION}
else
    gcloud compute instance-groups managed create cmux-proxy-mig \
        --base-instance-name=cmux-proxy \
        --template=cmux-proxy-template \
        --size=${MIN_REPLICAS} \
        --region=${REGION} \
        --health-check=cmux-proxy-health-check \
        --initial-delay=60
fi
echo -e "${GREEN}✓ Managed instance group configured${NC}"

# Setup autoscaling
echo -e "${BLUE}Setting up autoscaling...${NC}"
gcloud compute instance-groups managed set-autoscaling cmux-proxy-mig \
    --region=${REGION} \
    --min-num-replicas=${MIN_REPLICAS} \
    --max-num-replicas=${MAX_REPLICAS} \
    --target-cpu-utilization=0.6 \
    --cool-down-period=60
echo -e "${GREEN}✓ Autoscaling configured${NC}"

echo -e "${GREEN}=== Scaling Setup Complete ===${NC}"
echo ""
echo "Managed instance group: cmux-proxy-mig"
echo "Region: ${REGION}"
echo "Min replicas: ${MIN_REPLICAS}"
echo "Max replicas: ${MAX_REPLICAS}"
echo ""
echo "To view status:"
echo "  gcloud compute instance-groups managed list-instances cmux-proxy-mig --region=${REGION}"
echo ""
echo "To update the deployment:"
echo "  gcloud compute instance-groups managed rolling-action start-update cmux-proxy-mig \\"
echo "    --version=template=cmux-proxy-template \\"
echo "    --region=${REGION}"
