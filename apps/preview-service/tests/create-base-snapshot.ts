#!/usr/bin/env tsx
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { MorphCloudClient, type Instance } from 'morphcloud';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env file
const rootEnvPath = path.join(__dirname, '../../../.env');
console.log('Loading .env from:', rootEnvPath);
const result = dotenv.config({ path: rootEnvPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Successfully loaded .env file');
}

interface ExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

async function runCommand(
  instance: Instance,
  command: string,
  sudo = false,
  printOutput = true
): Promise<ExecResult> {
  const fullCommand = sudo && !command.startsWith('sudo ') ? `sudo ${command}` : command;

  console.log(`Running: ${fullCommand}`);
  const result = await instance.exec(fullCommand);

  if (printOutput) {
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(`ERR: ${result.stderr}`);
    }
  }

  if (result.exit_code !== 0) {
    console.log(`Command failed with exit code ${result.exit_code}`);
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exit_code,
  };
}

async function setupBaseEnvironment(instance: Instance) {
  console.log('\n--- Installing base dependencies ---');

  await runCommand(
    instance,
    'DEBIAN_FRONTEND=noninteractive apt-get update && ' +
    'DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ' +
    'ca-certificates curl wget git python3 make g++ bash nano net-tools ' +
    'sudo supervisor openssl pigz xz-utils unzip tmux && ' +
    'rm -rf /var/lib/apt/lists/*',
    true
  );
}

async function setupDocker(instance: Instance) {
  console.log('\n--- Setting up Docker ---');

  await runCommand(
    instance,
    'DEBIAN_FRONTEND=noninteractive apt-get update && ' +
    'DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io && ' +
    'rm -rf /var/lib/apt/lists/*',
    true
  );

  // Enable BuildKit
  await runCommand(
    instance,
    'mkdir -p /etc/docker && ' +
    'echo \'{"features":{"buildkit":true}}\' > /etc/docker/daemon.json && ' +
    'echo \'DOCKER_BUILDKIT=1\' >> /etc/environment',
    true
  );

  // Start Docker
  await runCommand(instance, 'systemctl start docker', true);
  await runCommand(instance, 'systemctl enable docker', true);

  // Wait for Docker to be ready
  console.log('Waiting for Docker daemon...');
  for (let i = 0; i < 10; i++) {
    const result = await runCommand(
      instance,
      'docker info >/dev/null 2>&1 && echo "ready" || echo "not ready"',
      true,
      false
    );
    if (result.stdout.includes('ready')) {
      console.log('Docker is ready');
      break;
    }
    console.log(`Waiting... (${i + 1}/10)`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function setupNodeAndBun(instance: Instance) {
  console.log('\n--- Installing Node.js 22.x ---');

  await runCommand(
    instance,
    'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && ' +
    'apt-get install -y nodejs && ' +
    'rm -rf /var/lib/apt/lists/*',
    true
  );

  const nodeVersion = await runCommand(instance, 'node --version');
  console.log(`Node.js installed: ${nodeVersion.stdout.trim()}`);

  console.log('\n--- Installing Bun ---');
  await runCommand(instance, 'curl -fsSL https://bun.sh/install | bash');
  await runCommand(instance, 'echo "export PATH=/root/.bun/bin:$PATH" >> ~/.bashrc');

  const bunVersion = await runCommand(instance, '/root/.bun/bin/bun --version');
  console.log(`Bun installed: ${bunVersion.stdout.trim()}`);
}

async function installGlobalPackages(instance: Instance) {
  console.log('\n--- Installing global packages ---');

  const packages = [
    '@devcontainers/cli',
    '@openai/codex',
    '@anthropic-ai/claude-code',
    '@google/gemini-cli',
    'opencode-ai',
    'codebuff',
    '@sourcegraph/amp',
  ];

  await runCommand(
    instance,
    `/root/.bun/bin/bun add -g ${packages.join(' ')}`,
    false,
    true
  );
}

async function setupOpenVSCode(instance: Instance) {
  console.log('\n--- Installing OpenVSCode server ---');

  // Get latest release
  const result = await runCommand(
    instance,
    'curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" | ' +
    'grep \\"tag_name\\" | awk -F\'\\"\' \'{print $4}\' | sed \'s|^openvscode-server-v||\'',
    false,
    false
  );

  const codeRelease = result.stdout.trim();
  console.log(`Latest OpenVSCode server version: ${codeRelease}`);

  // Detect architecture
  const archResult = await runCommand(instance, 'dpkg --print-architecture', false, false);
  const arch = archResult.stdout.trim();
  const archName = arch === 'amd64' ? 'x64' : arch === 'arm64' ? 'arm64' : null;

  if (!archName) {
    throw new Error(`Unsupported architecture: ${arch}`);
  }

  // Download and install
  await runCommand(
    instance,
    `mkdir -p /app/openvscode-server && ` +
    `curl -L -o /tmp/openvscode-server.tar.gz ` +
    `"https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${codeRelease}/` +
    `openvscode-server-v${codeRelease}-linux-${archName}.tar.gz" && ` +
    `tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1 && ` +
    `rm -rf /tmp/openvscode-server.tar.gz`,
    true
  );

  console.log('OpenVSCode server installed successfully');
}

async function setupVSCodeSettings(instance: Instance) {
  console.log('\n--- Setting up VS Code settings ---');

  const settings = '{"workbench.startupEditor": "none"}';
  const dirs = [
    '/root/.openvscode-server/data/User',
    '/root/.openvscode-server/data/User/profiles/default-profile',
    '/root/.openvscode-server/data/Machine',
  ];

  for (const dir of dirs) {
    await runCommand(instance, `mkdir -p ${dir}`, true);
    await runCommand(
      instance,
      `sh -c 'echo \\'${settings}\\' > ${dir}/settings.json'`,
      true
    );
  }
}

async function copyWorkerFiles(instance: Instance) {
  console.log('\n--- Copying worker files ---');

  // Get the project root (3 levels up from tests directory)
  const projectRoot = path.resolve(__dirname, '../../..');
  
  // Create minimal worker files
  await runCommand(instance, 'mkdir -p /builtins/build', true);
  
  // Create a simple worker index.js that responds to health checks
  const workerCode = `
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
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

  await runCommand(
    instance,
    `cat > /builtins/build/index.js << 'EOF'
${workerCode}
EOF`,
    true
  );

  // Create package.json for worker
  await runCommand(
    instance,
    `cat > /builtins/package.json << 'EOF'
{
  "name": "cmux-worker",
  "version": "1.0.0",
  "main": "build/index.js",
  "dependencies": {
    "socket.io": "^4.7.2"
  }
}
EOF`,
    true
  );

  // Install worker dependencies
  await runCommand(instance, 'cd /builtins && npm install', true);
}

async function createStartupScript(instance: Instance) {
  console.log('\n--- Creating startup script ---');

  const startupScript = `#!/bin/sh
set -e

# Start Docker daemon
dockerd &
DOCKER_PID=$!

# Wait for Docker
echo "Waiting for Docker daemon..."
for i in \$(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    echo "Docker is ready"
    break
  fi
  sleep 1
done

# Create log directories
mkdir -p /var/log/cmux

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

  await runCommand(
    instance,
    `cat > /startup.sh << 'EOF'
${startupScript}
EOF`,
    true
  );

  await runCommand(instance, 'chmod +x /startup.sh', true);
}

async function startServices(instance: Instance) {
  console.log('\n--- Starting services ---');

  // Create workspace directory
  await runCommand(instance, 'mkdir -p /root/workspace', true);

  // Expose HTTP services
  await instance.exposeHttpService('vscode', 39378);
  await instance.exposeHttpService('worker', 39377);

  // Start services
  await runCommand(
    instance,
    'nohup /startup.sh > /var/log/startup.log 2>&1 &',
    true
  );

  // Wait for services to start
  console.log('Waiting for services to start...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check services
  console.log('\n--- Checking services ---');

  const vsCodeCheck = await runCommand(
    instance,
    'ps aux | grep openvscode-server | grep -v grep',
    true,
    false
  );

  if (vsCodeCheck.stdout) {
    console.log('✅ OpenVSCode server is running');
  } else {
    console.log('❌ OpenVSCode server is not running');
    await runCommand(instance, 'cat /var/log/cmux/vscode.log | tail -20', true);
  }

  const workerCheck = await runCommand(
    instance,
    'ps aux | grep "node /builtins/build/index.js" | grep -v grep',
    true,
    false
  );

  if (workerCheck.stdout) {
    console.log('✅ Worker is running');
  } else {
    console.log('❌ Worker is not running');
    await runCommand(instance, 'cat /var/log/cmux/worker.log | tail -20', true);
  }
}

async function testServices(instance: Instance): Promise<boolean> {
  console.log('\n--- Testing services ---');

  // Get service URLs
  const freshInstance = await new MorphCloudClient().instances.get({ 
    instanceId: instance.id 
  });

  let vscodeUrl: string | null = null;
  let workerUrl: string | null = null;

  for (const service of freshInstance.networking.httpServices) {
    if (service.name === 'vscode') {
      vscodeUrl = service.url;
    } else if (service.name === 'worker') {
      workerUrl = service.url;
    }
  }

  if (!vscodeUrl || !workerUrl) {
    console.error('Could not find service URLs');
    return false;
  }

  console.log(`VS Code URL: ${vscodeUrl}`);
  console.log(`Worker URL: ${workerUrl}`);

  // Test VS Code
  try {
    const vscodeResponse = await fetch(vscodeUrl);
    if (vscodeResponse.ok) {
      console.log('✅ VS Code server is accessible');
    } else {
      console.log(`❌ VS Code server returned status: ${vscodeResponse.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to connect to VS Code server:', error);
    return false;
  }

  // Test worker
  try {
    const workerResponse = await fetch(`${workerUrl}/socket.io/?EIO=4&transport=polling`);
    if (workerResponse.ok) {
      console.log('✅ Worker is accessible');
    } else {
      console.log(`❌ Worker returned status: ${workerResponse.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to connect to worker:', error);
    return false;
  }

  return true;
}

async function main() {
  // Check if API key is loaded
  if (!process.env.MORPH_API_KEY) {
    console.error('Error: MORPH_API_KEY not found in environment variables');
    console.error('Please ensure .env file exists and contains MORPH_API_KEY');
    process.exit(1);
  }
  
  console.log('Using Morph API key:', process.env.MORPH_API_KEY.substring(0, 10) + '...');
  
  const client = new MorphCloudClient();

  // Configuration
  const VCPUS = 4;
  const MEMORY = 8192;
  const DISK_SIZE = 20480;

  console.log('Creating initial snapshot...');
  const snapshot = await client.snapshots.create({
    vcpus: VCPUS,
    memory: MEMORY,
    diskSize: DISK_SIZE,
  });

  console.log(`Starting instance from snapshot ${snapshot.id}...`);
  const instance = await client.instances.start({
    snapshotId: snapshot.id,
  });

  try {
    // Wait for instance to be ready
    await instance.waitUntilReady();
    console.log('Instance is ready');

    // Setup steps
    await setupBaseEnvironment(instance);
    await setupDocker(instance);
    await setupNodeAndBun(instance);
    await installGlobalPackages(instance);
    await setupOpenVSCode(instance);
    await setupVSCodeSettings(instance);
    await copyWorkerFiles(instance);
    await createStartupScript(instance);
    await startServices(instance);

    // Test services
    const success = await testServices(instance);
    
    if (!success) {
      throw new Error('Service tests failed');
    }

    // Create final snapshot
    console.log('\n--- Creating final snapshot ---');
    const finalSnapshot = await instance.snapshot({
      metadata: {
        name: `cmux-preview-base-${Date.now()}`,
        description: 'Base snapshot for cmux preview environments with VS Code and Docker',
      },
    });

    console.log(`\n✅ Successfully created base snapshot: ${finalSnapshot.id}`);
    console.log('\nTo use this snapshot in the preview service:');
    console.log(`1. Set MORPH_BASE_SNAPSHOT_ID=${finalSnapshot.id} in your .env file`);
    console.log('2. Or call POST /api/preview/set-base-snapshot with the snapshot ID');

    // Save snapshot ID to file
    const envPath = path.join(__dirname, '../.env');
    const envContent = `MORPH_BASE_SNAPSHOT_ID=${finalSnapshot.id}\n`;
    await fs.appendFile(envPath, envContent);
    console.log(`\nSnapshot ID saved to ${envPath}`);

  } finally {
    // Stop the instance
    console.log('\nStopping instance...');
    await instance.stop();
    console.log('Instance stopped');
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});