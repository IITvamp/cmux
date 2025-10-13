#!/bin/bash
set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-YOUR_PROJECT_ID}"
REGION="us-central1"
ZONE="us-central1-a"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== CMUX Proxy Cleanup ===${NC}"
echo -e "${RED}WARNING: This will delete all cmux-proxy resources!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

# Delete managed instance group if exists
echo -e "${YELLOW}Checking for managed instance group...${NC}"
if gcloud compute instance-groups managed describe cmux-proxy-mig --region=${REGION} &> /dev/null; then
    echo "Deleting managed instance group..."
    gcloud compute instance-groups managed delete cmux-proxy-mig --region=${REGION} --quiet
    echo -e "${GREEN}✓ Managed instance group deleted${NC}"
fi

# Delete instance template if exists
echo -e "${YELLOW}Checking for instance template...${NC}"
if gcloud compute instance-templates describe cmux-proxy-template &> /dev/null; then
    echo "Deleting instance template..."
    gcloud compute instance-templates delete cmux-proxy-template --quiet
    echo -e "${GREEN}✓ Instance template deleted${NC}"
fi

# Delete VM instance if exists
echo -e "${YELLOW}Checking for VM instance...${NC}"
if gcloud compute instances describe cmux-proxy-vm --zone=${ZONE} &> /dev/null; then
    echo "Deleting VM instance..."
    gcloud compute instances delete cmux-proxy-vm --zone=${ZONE} --quiet
    echo -e "${GREEN}✓ VM instance deleted${NC}"
fi

# Delete health check if exists
echo -e "${YELLOW}Checking for health check...${NC}"
if gcloud compute health-checks describe cmux-proxy-health-check &> /dev/null; then
    echo "Deleting health check..."
    gcloud compute health-checks delete cmux-proxy-health-check --quiet
    echo -e "${GREEN}✓ Health check deleted${NC}"
fi

# Delete firewall rules if exists
echo -e "${YELLOW}Checking for firewall rules...${NC}"
if gcloud compute firewall-rules describe allow-cmux-proxy &> /dev/null; then
    echo "Deleting firewall rules..."
    gcloud compute firewall-rules delete allow-cmux-proxy --quiet
    echo -e "${GREEN}✓ Firewall rules deleted${NC}"
fi

# Optionally delete static IP if exists
echo -e "${YELLOW}Checking for static IP...${NC}"
if gcloud compute addresses describe cmux-proxy-ip --region=${REGION} &> /dev/null; then
    read -p "Delete static IP address? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        gcloud compute addresses delete cmux-proxy-ip --region=${REGION} --quiet
        echo -e "${GREEN}✓ Static IP deleted${NC}"
    fi
fi

echo -e "${GREEN}=== Cleanup Complete ===${NC}"
echo ""
echo "Note: Docker images in GCR are not automatically deleted."
echo "To delete images manually:"
echo "  gcloud container images list --repository=gcr.io/${PROJECT_ID}"
echo "  gcloud container images delete gcr.io/${PROJECT_ID}/cmux-proxy:latest --quiet"
