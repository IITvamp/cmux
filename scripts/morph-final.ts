#!/usr/bin/env tsx
import { MorphCloudClient } from "morphcloud";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function main() {
  try {
    const client = new MorphCloudClient();

    console.log("Creating snapshot with Docker pre-installed...");
    
    // Use the setup command to create a snapshot with Docker and worker
    const snapshot = await client.snapshots.create({
      imageId: "morphvm-minimal",
      vcpus: 4,
      memory: 4096, 
      diskSize: 8192,
    });

    // Setup the snapshot with our installation script
    const setupCommand = `
      # Update and install dependencies
      apt-get update && apt-get install -y docker.io curl nodejs npm
      
      # Start Docker
      systemctl start docker
      systemctl enable docker
      
      # Install Bun
      curl -fsSL https://bun.sh/install | bash
      export PATH="/root/.bun/bin:$PATH"
      
      # Create a simple worker test
      mkdir -p /worker
      cat > /worker/test.js << 'EOF'
console.log("Worker is ready!");
console.log("Node version:", process.version);
console.log("Environment:", process.env.NODE_ENV);
EOF

      # Create startup script
      cat > /startup.sh << 'EOF'
#!/bin/sh
echo "Starting Docker daemon..."
dockerd &
sleep 5
echo "Docker ready, starting worker..."
cd /worker
NODE_ENV=production node test.js
EOF
      chmod +x /startup.sh
      
      echo "Setup complete!"
    `;

    console.log("Running setup on snapshot...");
    const finalSnapshot = await snapshot.setup(setupCommand);

    console.log(`\n✅ Success! Created snapshot: ${finalSnapshot.id}`);
    console.log("\nThis snapshot includes:");
    console.log("- Docker installed and configured");
    console.log("- Node.js and npm installed");
    console.log("- Bun installed");
    console.log("- Basic worker test script");
    console.log("\nTo use this snapshot:");
    console.log(`const instance = await client.instances.start({ snapshotId: "${finalSnapshot.id}" });`);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();