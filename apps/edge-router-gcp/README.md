# Edge Router - GCP Deployment

This is a Node.js/Express equivalent of the Cloudflare Worker edge router, designed to run on GCP VM instances in `us-central1` region.

## Features

- Reverse proxy with URL rewriting for cmux.sh domains
- Service worker injection for localhost interception
- JavaScript rewriting for location API proxying
- CSP header stripping
- CORS support
- WebSocket upgrade support (limited in current implementation)
- Docker containerization for easy deployment

## Architecture

This edge router is a drop-in replacement for the Cloudflare Worker version, implementing the same routing logic:

- `cmux.sh` - Returns greeting message
- `*.cmux.sh` - Proxies to various backend services
- `/proxy-sw.js` - Serves the service worker for localhost interception
- `port-*` subdomains - Routes to Morph VM services
- `cmux-*` subdomains - Routes with workspace scoping

## Local Development

### Prerequisites

- Node.js 24+
- Docker & Docker Compose
- npm

### Quick Start

```bash
# Using npm
npm install
npm run dev

# Using Docker Compose
npm run docker:dev
# or
docker-compose up --build

# Using Docker directly
npm run docker:build
npm run docker:run
```

The server will start on `http://localhost:8080`.

### Testing Locally

```bash
# Test the root endpoint
curl http://localhost:8080 -H "Host: cmux.sh"
# Expected output: cmux!

# Test the service worker
curl http://localhost:8080/proxy-sw.js -H "Host: port-8080-test.cmux.sh"
# Should return JavaScript code

# Test a proxy route (requires backend to be running)
curl http://localhost:8080 -H "Host: port-8080-your-morph-id.cmux.sh"
```

## GCP Deployment

### Prerequisites

You need the following credentials and tools:

1. **GCP Project ID**
   - Create a project at https://console.cloud.google.com/
   - Note your project ID (e.g., `my-cmux-project`)

2. **gcloud CLI**
   ```bash
   # Install gcloud CLI
   # See: https://cloud.google.com/sdk/docs/install

   # Authenticate
   gcloud auth login

   # Configure Docker to use GCR
   gcloud auth configure-docker
   ```

3. **Enable Required APIs**
   ```bash
   gcloud services enable compute.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

4. **Set up permissions**
   - Ensure your GCP account has the following roles:
     - `roles/compute.admin` - To create and manage VMs
     - `roles/storage.admin` - To push to Container Registry
     - `roles/iam.serviceAccountUser` - To deploy with service accounts

### Deployment Steps

1. **Set your GCP Project ID**
   ```bash
   export GCP_PROJECT_ID=your-project-id
   ```

2. **Run the deployment script**
   ```bash
   ./deploy-gcp.sh
   ```

   The script will:
   - Build the Docker image
   - Push to Google Container Registry (GCR)
   - Create a GCP VM instance with Container-Optimized OS
   - Configure firewall rules for HTTP/HTTPS traffic
   - Output the external IP address

3. **Note the External IP**
   After deployment, you'll see output like:
   ```
   Deployment complete!
   VM External IP: 34.123.45.67
   Service URL: http://34.123.45.67:8080
   ```

### DNS Configuration

Configure your DNS records to point to the VM's external IP:

```
A     cmux.sh           34.123.45.67
A     *.cmux.sh         34.123.45.67
```

### HTTPS/SSL Setup

For production, you should set up HTTPS:

#### Option 1: Using nginx on the same VM

1. **SSH into the VM**
   ```bash
   gcloud compute ssh edge-router --zone=us-central1-a
   ```

2. **Install nginx and certbot**
   ```bash
   sudo apt-get update
   sudo apt-get install -y nginx certbot python3-certbot-nginx
   ```

3. **Copy the nginx config**
   ```bash
   sudo cp /path/to/nginx.conf /etc/nginx/sites-available/cmux.conf
   sudo ln -s /etc/nginx/sites-available/cmux.conf /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   ```

4. **Get SSL certificates**
   ```bash
   sudo certbot --nginx -d cmux.sh -d '*.cmux.sh'
   ```

5. **Reload nginx**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### Option 2: Using GCP Load Balancer

1. Create a GCP HTTPS Load Balancer
2. Configure backend service pointing to your VM instance group
3. Upload SSL certificates
4. Configure health checks

See: https://cloud.google.com/load-balancing/docs/https

### Monitoring and Management

#### Check Logs
```bash
# SSH into VM and check container logs
gcloud compute ssh edge-router --zone=us-central1-a --command='sudo docker logs $(sudo docker ps -q)'

# Follow logs in real-time
gcloud compute ssh edge-router --zone=us-central1-a --command='sudo docker logs -f $(sudo docker ps -q)'
```

#### Update Deployment
```bash
# Simply re-run the deployment script
./deploy-gcp.sh
```

#### SSH into VM
```bash
gcloud compute ssh edge-router --zone=us-central1-a
```

#### Stop/Start VM
```bash
# Stop
gcloud compute instances stop edge-router --zone=us-central1-a

# Start
gcloud compute instances start edge-router --zone=us-central1-a
```

#### Delete VM
```bash
gcloud compute instances delete edge-router --zone=us-central1-a
```

### Cost Optimization

- **Machine Type**: The default is `e2-micro` (cheapest). Upgrade to `e2-small` or `e2-medium` if needed.
- **Sustained Use Discounts**: GCP automatically applies discounts for VMs that run most of the month
- **Committed Use Discounts**: Consider 1-year or 3-year commitments for additional savings
- **Preemptible VMs**: Not recommended for production, but can save 80% for dev/test environments

Current `e2-micro` costs approximately $7-10/month in us-central1.

## Environment Variables

- `PORT` - Port to listen on (default: 8080)
- `NODE_ENV` - Environment (development/production)

## Project Structure

```
edge-router-gcp/
├── src/
│   └── index.ts           # Main Express server
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Local development with Docker Compose
├── deploy-gcp.sh          # GCP deployment script
├── nginx.conf             # Sample nginx configuration for HTTPS
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Differences from Cloudflare Version

1. **WebSocket Proxying**: Limited implementation - returns 501. Full WebSocket support requires additional libraries like `http-proxy`
2. **HTMLRewriter**: Uses `node-html-parser` instead of Cloudflare's HTMLRewriter
3. **fetch API**: Uses `undici` for fetch support
4. **Performance**: May have slightly different performance characteristics due to Node.js vs V8 isolates

## Troubleshooting

### Container won't start
```bash
# Check container logs
docker logs edge-router-test

# Check if port 8080 is already in use
sudo lsof -i :8080
```

### Cannot connect to service
```bash
# Verify firewall rules
gcloud compute firewall-rules list

# Check VM status
gcloud compute instances describe edge-router --zone=us-central1-a

# Test from VM itself
gcloud compute ssh edge-router --zone=us-central1-a --command='curl http://localhost:8080'
```

### DNS not resolving
- Ensure DNS records are properly configured
- Wait for DNS propagation (can take up to 48 hours, usually much faster)
- Test with `dig cmux.sh` or `nslookup cmux.sh`

### SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew
```

## Security Considerations

1. **Firewall Rules**: Only necessary ports are exposed (80, 443, 8080)
2. **Container Isolation**: Application runs in Docker container
3. **HTTPS**: Configure SSL/TLS for production
4. **Updates**: Regularly update the base image and dependencies
5. **Secrets**: Never commit credentials to git

## Contributing

When making changes:
1. Test locally with Docker first
2. Update this README if needed
3. Test deployment to a staging GCP project
4. Update version in package.json

## License

Same as parent cmux project.
