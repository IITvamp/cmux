# Edge Router for GCP VM

This package reimplements the Cloudflare Worker at `apps/edge-router` as a long-running Node.js service that can run on a Google Compute Engine (GCE) VM. It proxies `*.cmux.sh` traffic to Morph and freestyle VMs while applying the same HTML/JS rewrites and loopback redirect handling the worker provided.

## Local development

- Install dependencies: `bun install`
- Run unit/integration tests: `bun run test`
- Type-check and build: `bun run build`
- Start locally with hot reload: `bun run dev` (listens on `PORT` or `8787`).

Environment variables:

- `PORT` (default `8787`)
- `HOST` (default `0.0.0.0`)
- `ALLOW_INSECURE_TARGET=1` allows proxying to HTTP origins (useful for tests only).

## Docker image

A multi-stage `Dockerfile` is included. Example usage:

```bash
docker build -t edge-router-gcp:latest apps/edge-router-gcp
# Run locally
docker run --rm -p 8787:8787 edge-router-gcp:latest
```

## Deployment plan (GCP VM in `us-central1`)

1. **Build and push the image**
   ```bash
   PROJECT_ID=your-project
   REGION=us-central1
   IMAGE_NAME=edge-router-gcp

   gcloud auth configure-docker ${REGION}-docker.pkg.dev
   docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/edge-router/${IMAGE_NAME}:v1 apps/edge-router-gcp
   docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/edge-router/${IMAGE_NAME}:v1
   ```

2. **Provision a VM** (Container-Optimized OS is recommended so Docker is preinstalled):
   ```bash
   gcloud compute instances create-with-container edge-router \
     --project=${PROJECT_ID} \
     --zone=us-central1-a \
     --machine-type=e2-small \
     --scopes=https://www.googleapis.com/auth/cloud-platform \
     --container-image=${REGION}-docker.pkg.dev/${PROJECT_ID}/edge-router/${IMAGE_NAME}:v1 \
     --container-env=PORT=8080 \
     --tags=edge-router \
     --boot-disk-size=20GB
   ```
   Adjust the container `PORT` to match your load balancer/backend configuration.

3. **Networking**
   - Open the listener port: `gcloud compute firewall-rules create edge-router-http --network=default --allow=tcp:80 --target-tags=edge-router`
   - Terminate TLS at a Google HTTPS Load Balancer or run an Envoy/Nginx sidecar that terminates TLS and forwards to port 8787.

4. **Health checks and autoscaling** (optional)
   - Add a simple `/healthz` endpoint if desired and configure a GCE health check.
   - Use Managed Instance Groups if you want automatic restarts or scaling.

### Required credentials

- Artifact Registry push: `roles/artifactregistry.writer` (or above)
- Compute Engine deployment: `roles/compute.instanceAdmin.v1`, `roles/iam.serviceAccountUser`
- Firewall updates: `roles/compute.networkAdmin`

A dedicated deployment service account with the minimal set above is recommended. Provide its JSON key locally or run `gcloud auth login` before executing the commands.
