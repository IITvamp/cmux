# Making the Docker Image Public

## GitHub Container Registry (Current Setup)

To make the image public on GitHub Container Registry:

1. Go to https://github.com/lawrencecchen/coderouter/packages
2. Click on the `cmux-worker` package
3. On the package page, click "Package settings" (gear icon)
4. Scroll to "Danger Zone" section
5. Click "Change visibility" and select "Public"

Once public, anyone can pull without authentication:
```bash
docker pull ghcr.io/lawrencecchen/coderouter/cmux-worker:latest
```

## Docker Hub (Alternative)

To publish to Docker Hub instead:

1. Create secrets in your GitHub repository:
   - `DOCKERHUB_USERNAME`: Your Docker Hub username
   - `DOCKERHUB_TOKEN`: Docker Hub access token (create at https://hub.docker.com/settings/security)

2. The workflow will publish to `<your-username>/cmux-worker`

3. Users can then pull without authentication:
   ```bash
   docker pull <your-username>/cmux-worker:latest
   ```

Note: Docker Hub is public by default for free accounts.