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

async function exec(instance: Instance, command: string): Promise<void> {
  console.log(`\n$ ${command}`);
  const result = await instance.exec(command);
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.exit_code !== 0) {
    throw new Error(`Command failed with exit code ${result.exit_code}`);
  }
}

async function main() {
  const client = new MorphCloudClient();
  let instance: Instance | null = null;

  try {
    // 1. Create base snapshot
    console.log('📦 Creating base snapshot...');
    const snapshot = await client.snapshots.create({
      vcpus: 2,
      memory: 4096,
      diskSize: 16384,
    });

    // 2. Start instance
    console.log(`🚀 Starting instance from snapshot ${snapshot.id}...`);
    instance = await client.instances.start({ snapshotId: snapshot.id });
    await instance.waitUntilReady();
    console.log('✅ Instance ready');

    // 3. Install essential packages
    console.log('\n📥 Installing essential packages...');
    await exec(instance, 'apt-get update');
    await exec(instance, 'apt-get install -y curl git nodejs npm docker.io');
    
    // 4. Install Bun
    console.log('\n📥 Installing Bun...');
    await exec(instance, 'curl -fsSL https://bun.sh/install | bash');
    await exec(instance, 'echo "export PATH=/root/.bun/bin:$PATH" >> ~/.bashrc');

    // 5. Install global packages
    console.log('\n📥 Installing global packages...');
    await exec(instance, '/root/.bun/bin/bun add -g @devcontainers/cli');

    // 6. Create minimal worker
    console.log('\n📝 Creating minimal worker...');
    await exec(instance, 'mkdir -p /builtins/build');
    
    const workerCode = `
const http = require('http');
const PORT = process.env.WORKER_PORT || 39377;
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Worker is running');
});
server.listen(PORT, () => console.log(\`Worker listening on port \${PORT}\`));
`;
    
    await exec(instance, `cat > /builtins/build/index.js << 'EOF'${workerCode}\nEOF`);

    // 7. Install OpenVSCode
    console.log('\n📥 Installing OpenVSCode...');
    await exec(instance, 'mkdir -p /app/openvscode-server');
    await exec(instance, 
      'curl -L https://github.com/gitpod-io/openvscode-server/releases/latest/download/openvscode-server-v1.95.0-linux-x64.tar.gz | ' +
      'tar xz -C /app/openvscode-server --strip-components=1'
    );

    // 8. Create startup script
    console.log('\n📝 Creating startup script...');
    const startupScript = `#!/bin/bash
echo "Starting services..."
mkdir -p /var/log/cmux

# Start Docker
dockerd &

# Start OpenVSCode
/app/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 39378 --without-connection-token > /var/log/cmux/vscode.log 2>&1 &

# Start worker
cd /builtins && NODE_ENV=production WORKER_PORT=39377 node /builtins/build/index.js > /var/log/cmux/worker.log 2>&1 &

echo "All services started"
tail -f /dev/null
`;
    
    await exec(instance, `cat > /startup.sh << 'EOF'${startupScript}\nEOF`);
    await exec(instance, 'chmod +x /startup.sh');

    // 9. Create workspace
    await exec(instance, 'mkdir -p /root/workspace');

    // 10. Expose services
    console.log('\n🌐 Exposing services...');
    await instance.exposeHttpService('vscode', 39378);
    await instance.exposeHttpService('worker', 39377);

    // 11. Start services
    console.log('\n🚀 Starting services...');
    await exec(instance, 'nohup /startup.sh > /var/log/startup.log 2>&1 &');
    
    // Wait for services
    console.log('⏳ Waiting for services to start...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 12. Test services
    console.log('\n🧪 Testing services...');
    const freshInstance = await client.instances.get({ instanceId: instance.id });
    
    for (const service of freshInstance.networking.httpServices) {
      console.log(`Service ${service.name}: ${service.url}`);
    }

    // 13. Create final snapshot
    console.log('\n📸 Creating final snapshot...');
    const finalSnapshot = await instance.snapshot({
      metadata: {
        name: `cmux-preview-base-${Date.now()}`,
        description: 'Base snapshot for cmux preview environments',
      },
    });

    console.log(`\n✅ Successfully created snapshot: ${finalSnapshot.id}`);
    
    // Save to .env file
    const envPath = path.join(__dirname, '../.env');
    await fs.writeFile(envPath, `MORPH_BASE_SNAPSHOT_ID=${finalSnapshot.id}\n`);
    console.log(`Saved snapshot ID to ${envPath}`);

  } catch (error) {
    console.error('❌ Error:', error);
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