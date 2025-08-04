#!/usr/bin/env tsx
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { MorphCloudClient, type Instance } from 'morphcloud';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

if (!process.env.MORPH_API_KEY) {
  console.error('Error: MORPH_API_KEY not found');
  process.exit(1);
}

async function exec(instance: Instance, command: string, showOutput = true): Promise<{ stdout: string; stderr: string; exit_code: number }> {
  if (showOutput) console.log(`\n$ ${command}`);
  const result = await instance.exec(command);
  if (showOutput) {
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
  if (result.exit_code !== 0) {
    throw new Error(`Command failed with exit code ${result.exit_code}: ${result.stderr || result.stdout}`);
  }
  return result;
}

async function main() {
  const client = new MorphCloudClient();
  let instance: Instance | null = null;

  try {
    // 1. Create base snapshot with more resources for building
    console.log('📦 Creating base snapshot...');
    const snapshot = await client.snapshots.create({
      vcpus: 4,
      memory: 8192,
      diskSize: 20480,
    });

    // 2. Start instance
    console.log(`🚀 Starting instance from snapshot ${snapshot.id}...`);
    instance = await client.instances.start({ snapshotId: snapshot.id });
    await instance.waitUntilReady();
    console.log('✅ Instance ready');

    // 3. Install base packages including Docker
    console.log('\n📥 Installing base packages and Docker...');
    await exec(instance, 'apt-get update');
    await exec(instance, 'DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ' +
      'ca-certificates curl wget git python3 make g++ bash nano net-tools ' +
      'sudo supervisor openssl pigz xz-utils unzip tmux'
    );

    // 4. Install Docker with proper setup
    console.log('\n🐳 Installing Docker...');
    await exec(instance, 'DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io');
    
    // Enable BuildKit
    await exec(instance, 'mkdir -p /etc/docker');
    await exec(instance, 'echo \'{"features":{"buildkit":true}}\' > /etc/docker/daemon.json');
    await exec(instance, 'echo \'DOCKER_BUILDKIT=1\' >> /etc/environment');
    
    // Start Docker
    await exec(instance, 'systemctl start docker');
    await exec(instance, 'systemctl enable docker');
    
    // Wait for Docker to be ready
    console.log('⏳ Waiting for Docker daemon...');
    for (let i = 0; i < 10; i++) {
      try {
        await exec(instance, 'docker info', false);
        console.log('✅ Docker is ready');
        break;
      } catch {
        if (i === 9) throw new Error('Docker failed to start');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 5. Install Node.js
    console.log('\n📥 Installing Node.js...');
    await exec(instance, 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -');
    await exec(instance, 'apt-get install -y nodejs');
    const nodeVersion = await exec(instance, 'node --version', false);
    console.log(`Node.js installed: ${nodeVersion.stdout.trim()}`);

    // 6. Install Bun
    console.log('\n📥 Installing Bun...');
    await exec(instance, 'curl -fsSL https://bun.sh/install | bash');
    await exec(instance, 'echo "export PATH=/root/.bun/bin:$PATH" >> ~/.bashrc');
    const bunVersion = await exec(instance, '/root/.bun/bin/bun --version', false);
    console.log(`Bun installed: ${bunVersion.stdout.trim()}`);

    // 7. Install global packages
    console.log('\n📥 Installing global packages...');
    await exec(instance, '/root/.bun/bin/bun add -g @devcontainers/cli');

    // 8. Install OpenVSCode Server
    console.log('\n📥 Installing OpenVSCode Server...');
    
    // Get latest release
    const releaseInfo = await exec(instance, 
      'curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" | ' +
      'grep \\"tag_name\\" | awk -F\'\\"\' \'{print $4}\' | sed \'s|^openvscode-server-v||\'',
      false
    );
    const codeRelease = releaseInfo.stdout.trim();
    console.log(`Latest OpenVSCode version: ${codeRelease}`);
    
    // Download and install
    await exec(instance, 'mkdir -p /app/openvscode-server');
    const downloadUrl = `https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${codeRelease}/openvscode-server-v${codeRelease}-linux-x64.tar.gz`;
    await exec(instance, `curl -L "${downloadUrl}" | tar xz -C /app/openvscode-server --strip-components=1`);

    // 9. Create worker directory and files
    console.log('\n📝 Creating worker...');
    await exec(instance, 'mkdir -p /builtins/build');
    
    const workerCode = `
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Worker is running');
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.WORKER_PORT || 39377;
server.listen(PORT, () => {
  console.log(\`Worker listening on port \${PORT}\`);
});
`;
    
    await exec(instance, `cat > /builtins/build/index.js << 'EOF'${workerCode}\nEOF`);
    
    // Create package.json for worker
    await exec(instance, `cat > /builtins/package.json << 'EOF'
{
  "name": "cmux-worker",
  "version": "1.0.0",
  "main": "build/index.js",
  "dependencies": {
    "socket.io": "^4.7.2"
  }
}
EOF`);
    
    // Install worker dependencies
    await exec(instance, 'cd /builtins && npm install');

    // 10. Create wait-for-docker script
    console.log('\n📝 Creating wait-for-docker script...');
    await exec(instance, `cat > /usr/local/bin/wait-for-docker.sh << 'EOF'
#!/bin/bash
set -e

echo "Waiting for Docker daemon to start..."
for i in {1..30}; do
  if docker info >/dev/null 2>&1; then
    echo "Docker daemon is ready"
    exit 0
  fi
  echo "Waiting for Docker daemon... ($i/30)"
  sleep 1
done

echo "Docker daemon failed to start"
exit 1
EOF`);
    await exec(instance, 'chmod +x /usr/local/bin/wait-for-docker.sh');

    // 11. Create startup script
    console.log('\n📝 Creating startup script...');
    const startupScript = `#!/bin/bash
set -e

echo "Starting services..."
mkdir -p /var/log/cmux

# Start Docker daemon
dockerd &
DOCKER_PID=$!

# Wait for Docker
wait-for-docker.sh

# Create workspace directory
mkdir -p /root/workspace

# Start OpenVSCode server
echo "Starting OpenVSCode server..."
/app/openvscode-server/bin/openvscode-server \\
  --host 0.0.0.0 \\
  --port 39378 \\
  --without-connection-token \\
  > /var/log/cmux/vscode.log 2>&1 &

# Start worker
echo "Starting worker..."
cd /builtins
NODE_ENV=production WORKER_PORT=39377 node /builtins/build/index.js \\
  > /var/log/cmux/worker.log 2>&1 &

echo "All services started"

# Keep the script running
tail -f /dev/null
`;
    
    await exec(instance, `cat > /startup.sh << 'EOF'${startupScript}\nEOF`);
    await exec(instance, 'chmod +x /startup.sh');

    // 12. Create VS Code settings
    console.log('\n⚙️ Setting up VS Code settings...');
    const settings = '{"workbench.startupEditor": "none"}';
    const dirs = [
      '/root/.openvscode-server/data/User',
      '/root/.openvscode-server/data/User/profiles/default-profile',
      '/root/.openvscode-server/data/Machine',
    ];
    
    for (const dir of dirs) {
      await exec(instance, `mkdir -p ${dir}`, false);
      await exec(instance, `echo '${settings}' > ${dir}/settings.json`, false);
    }

    // 13. Expose services
    console.log('\n🌐 Exposing services...');
    await instance.exposeHttpService('vscode', 39378);
    await instance.exposeHttpService('worker', 39377);

    // 14. Start services
    console.log('\n🚀 Starting services...');
    await exec(instance, 'nohup /startup.sh > /var/log/startup.log 2>&1 &');
    
    // Wait for services
    console.log('⏳ Waiting for services to start...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 15. Test services
    console.log('\n🧪 Testing services...');
    
    // Check processes
    const psResult = await exec(instance, 'ps aux | grep -E "(openvscode|node|docker)" | grep -v grep', false);
    console.log('Running processes:', psResult.stdout);
    
    // Test Docker
    try {
      await exec(instance, 'docker run --rm hello-world');
      console.log('✅ Docker test passed');
    } catch (error) {
      console.error('❌ Docker test failed:', error);
    }
    
    // Get service URLs
    const freshInstance = await client.instances.get({ instanceId: instance.id });
    console.log('\n📌 Service URLs:');
    for (const service of freshInstance.networking.httpServices) {
      console.log(`  ${service.name}: ${service.url}`);
    }

    // 16. Create final snapshot
    console.log('\n📸 Creating final snapshot...');
    const finalSnapshot = await instance.snapshot({
      metadata: {
        name: `cmux-preview-base-${Date.now()}`,
        description: 'Full base snapshot for cmux preview environments with Docker-in-Docker, VSCode, and worker',
      },
    });

    console.log(`\n✅ Successfully created snapshot: ${finalSnapshot.id}`);
    
    // Save to .env file in preview-service directory
    const envPath = path.join(__dirname, '../.env');
    const envContent = `# Morph base snapshot ID for preview environments
MORPH_BASE_SNAPSHOT_ID=${finalSnapshot.id}

# Copy any other needed env vars from root .env
`;
    await fs.writeFile(envPath, envContent);
    console.log(`\n📝 Saved snapshot ID to ${envPath}`);
    console.log('\nNext steps:');
    console.log('1. Run tests: pnpm test');
    console.log('2. Run full tests: RUN_EXPENSIVE_TESTS=true pnpm test');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    // Clean up
    if (instance) {
      console.log('\n🧹 Stopping instance...');
      await instance.stop();
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});