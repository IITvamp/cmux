#!/usr/bin/env tsx
import dotenv from "dotenv";
import fs from "fs/promises";
import { Instance, MorphCloudClient } from "morphcloud";
import path from "path";
import { io } from "socket.io-client";
import { fileURLToPath } from "url";
import { DockerfileParser, DockerfileExecutor } from "./dockerfile-parser.js";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env from repo root if available; fall back to scripts/.env
const rootEnvPath = path.join(__dirname, "..", ".env");
const scriptsEnvPath = path.join(__dirname, ".env");
dotenv.config({ path: (await fs.stat(rootEnvPath).then(() => rootEnvPath).catch(() => scriptsEnvPath)) });

async function runSSHCommand(
  instance: Instance,
  command: string,
  sudo = false,
  printOutput = true
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const fullCommand =
    sudo && !command.startsWith("sudo ") ? `sudo ${command}` : command;

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
    exitCode: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function setupBaseEnvironment(instance: Instance) {
  console.log("\n--- Setting up base environment ---");

  // First, let's check what OS we're running on
  const osCheck = await runSSHCommand(
    instance,
    "cat /etc/os-release || echo 'Unknown OS'",
    true
  );
  console.log("OS Info:", osCheck.stdout);

  // Update package lists
  await runSSHCommand(instance, "apt-get update", true);
  
  // Install essential tools needed for the build process
  await runSSHCommand(
    instance,
    "DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl wget git python3 make g++ bash gnupg unzip",
    true
  );
}

async function installNodeAndBun(instance: Instance) {
  console.log("\n--- Installing Node.js and Bun ---");

  // Install Node.js 24.x
  await runSSHCommand(
    instance,
    "curl -fsSL https://deb.nodesource.com/setup_24.x | bash -",
    true
  );
  await runSSHCommand(instance, "apt-get install -y nodejs", true);
  
  // Enable pnpm via corepack
  await runSSHCommand(instance, "npm install -g node-gyp", true);
  await runSSHCommand(instance, "corepack enable", true);
  await runSSHCommand(instance, "corepack prepare pnpm@10.14.0 --activate", true);

  // Install Bun
  await runSSHCommand(
    instance,
    "curl -fsSL https://bun.sh/install | bash",
    true
  );
  await runSSHCommand(
    instance,
    "mv /root/.bun/bin/bun /usr/local/bin/ && ln -s /usr/local/bin/bun /usr/local/bin/bunx",
    true
  );
  
  // Verify installations
  await runSSHCommand(instance, "node --version && npm --version && bun --version", true);
}

async function installDocker(instance: Instance) {
  console.log("\n--- Installing Docker ---");

  const DOCKER_VERSION = "28.3.2";
  const DOCKER_CHANNEL = "stable";

  // Install Docker dependencies
  await runSSHCommand(
    instance,
    "DEBIAN_FRONTEND=noninteractive apt-get install -y iptables openssl pigz xz-utils",
    true
  );

  // Set iptables-legacy (required for Docker in Docker on Ubuntu 22.04+)
  await runSSHCommand(
    instance,
    "update-alternatives --set iptables /usr/sbin/iptables-legacy || true",
    true
  );

  // Install Docker binary
  const dockerInstallScript = `
    set -eux
    arch="$(uname -m)"
    case "$arch" in
        x86_64) dockerArch='x86_64' ;;
        aarch64) dockerArch='aarch64' ;;
        *) echo >&2 "error: unsupported architecture ($arch)"; exit 1 ;;
    esac
    wget -O docker.tgz "https://download.docker.com/linux/static/${DOCKER_CHANNEL}/\${dockerArch}/docker-${DOCKER_VERSION}.tgz"
    tar --extract --file docker.tgz --strip-components 1 --directory /usr/local/bin/
    rm docker.tgz
    dockerd --version
    docker --version
  `;

  await runSSHCommand(instance, dockerInstallScript, true);

  // Install Docker Compose and Buildx plugins
  const pluginInstallScript = `
    set -eux
    mkdir -p /usr/local/lib/docker/cli-plugins
    arch="$(uname -m)"
    # Install Docker Compose
    curl -SL "https://github.com/docker/compose/releases/download/v2.32.2/docker-compose-linux-\${arch}" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    # Install Docker Buildx
    curl -SL "https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-\${arch}" \
        -o /usr/local/lib/docker/cli-plugins/docker-buildx
    chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
    echo "Docker plugins installed successfully"
  `;

  await runSSHCommand(instance, pluginInstallScript, true);

  // Install supervisor for managing dockerd
  await runSSHCommand(
    instance,
    "DEBIAN_FRONTEND=noninteractive apt-get install -y supervisor",
    true
  );

  // Create supervisor config for dockerd
  const supervisorConfig = `[program:dockerd]
command=/usr/local/bin/dockerd
autostart=true
autorestart=true
stderr_logfile=/var/log/dockerd.err.log
stdout_logfile=/var/log/dockerd.out.log`;

  await runSSHCommand(
    instance,
    `mkdir -p /etc/supervisor/conf.d && echo '${supervisorConfig}' > /etc/supervisor/conf.d/dockerd.conf`,
    true
  );

  // Start supervisor and dockerd
  await runSSHCommand(instance, "supervisord -c /etc/supervisor/supervisord.conf || true", true);
  
  // Wait for Docker to be ready
  console.log("Waiting for Docker daemon to initialize...");
  for (let i = 0; i < 10; i++) {
    const result = await runSSHCommand(
      instance,
      "docker info >/dev/null 2>&1 && echo 'ready' || echo 'not ready'",
      true,
      false
    );
    if (result.stdout.includes("ready")) {
      console.log("Docker is ready");
      break;
    }
    console.log(`Waiting for Docker... (${i + 1}/10)`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function installAdditionalTools(instance: Instance) {
  console.log("\n--- Installing additional tools ---");

  // Install runtime dependencies
  await runSSHCommand(
    instance,
    "DEBIAN_FRONTEND=noninteractive apt-get install -y nano net-tools lsof sudo tmux ripgrep",
    true
  );

  // Install GitHub CLI
  await runSSHCommand(
    instance,
    `curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
     chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
     echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
     apt-get update && apt-get install -y gh`,
    true
  );

  // Install global npm packages
  await runSSHCommand(
    instance,
    "bun add -g @openai/codex@0.20.0 @anthropic-ai/claude-code@1.0.72 @google/gemini-cli opencode-ai@latest codebuff @devcontainers/cli @sourcegraph/amp",
    true
  );

  // Install cursor cli
  await runSSHCommand(
    instance,
    "curl https://cursor.com/install -fsS | bash",
    true
  );
}

async function installOpenVSCode(instance: Instance) {
  console.log("\n--- Installing OpenVSCode Server ---");

  // Get latest release
  const codeReleaseScript = `
    CODE_RELEASE=$(curl -sX GET "https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest" \
      | awk '/tag_name/{print $4;exit}' FS='[""]' \
      | sed 's|^openvscode-server-v||')
    echo $CODE_RELEASE
  `;

  const releaseResult = await runSSHCommand(instance, codeReleaseScript, false);
  const codeRelease = releaseResult.stdout.trim();
  console.log(`Installing OpenVSCode Server version: ${codeRelease}`);

  // Download and install OpenVSCode
  const installScript = `
    arch="$(dpkg --print-architecture)"
    if [ "$arch" = "amd64" ]; then
      ARCH="x64"
    elif [ "$arch" = "arm64" ]; then
      ARCH="arm64"
    fi
    mkdir -p /app/openvscode-server
    curl -fsSL -o /tmp/openvscode-server.tar.gz \
      "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${codeRelease}/openvscode-server-v${codeRelease}-linux-\${ARCH}.tar.gz"
    tar xf /tmp/openvscode-server.tar.gz -C /app/openvscode-server/ --strip-components=1
    rm -rf /tmp/openvscode-server.tar.gz
  `;

  await runSSHCommand(instance, installScript, true);

  // Create VS Code user settings
  const vsCodeSettings = {
    "workbench.startupEditor": "none",
    "terminal.integrated.macOptionClickForcesSelection": true
  };

  await runSSHCommand(
    instance,
    `mkdir -p /root/.openvscode-server/data/User && \
     echo '${JSON.stringify(vsCodeSettings)}' > /root/.openvscode-server/data/User/settings.json && \
     mkdir -p /root/.openvscode-server/data/User/profiles/default-profile && \
     echo '${JSON.stringify(vsCodeSettings)}' > /root/.openvscode-server/data/User/profiles/default-profile/settings.json && \
     mkdir -p /root/.openvscode-server/data/Machine && \
     echo '${JSON.stringify(vsCodeSettings)}' > /root/.openvscode-server/data/Machine/settings.json`,
    true
  );
}

async function executeDockerfile(instance: Instance) {
  console.log("\n--- Executing Dockerfile instructions ---");

  const projectRoot = path.join(__dirname, "..");
  const dockerfilePath = path.join(projectRoot, "Dockerfile");

  // Parse the Dockerfile
  const parser = new DockerfileParser(dockerfilePath, projectRoot);
  const parsedDockerfile = await parser.parse(dockerfilePath);

  console.log(`Parsed ${parsedDockerfile.instructions.length} instructions from Dockerfile`);

  // Execute the Dockerfile instructions
  const executor = new DockerfileExecutor(instance, projectRoot);
  await executor.execute(parsedDockerfile);
}

async function createStartupScripts(instance: Instance) {
  console.log("\n--- Creating startup scripts ---");

  // Create modprobe script (required for DinD)
  const modprobeScript = `#!/bin/sh
set -eu
# "modprobe" without modprobe
for module; do
    if [ "\${module#-}" = "$module" ]; then
        ip link show "$module" || true
        lsmod | grep "$module" || true
    fi
done
# remove /usr/local/... from PATH so we can exec the real modprobe as a last resort
export PATH='/usr/sbin:/usr/bin:/sbin:/bin'
exec modprobe "$@"`;

  await runSSHCommand(
    instance,
    `cat > /usr/local/bin/modprobe << 'EOF'
${modprobeScript}
EOF`,
    true
  );
  await runSSHCommand(instance, "chmod +x /usr/local/bin/modprobe", true);

  // Copy startup.sh from the project if it exists
  const startupPath = path.join(__dirname, "..", "startup.sh");
  try {
    const startupContent = await fs.readFile(startupPath, "utf-8");
    await runSSHCommand(
      instance,
      `cat > /startup.sh << 'EOF'
${startupContent}
EOF`,
      true
    );
    await runSSHCommand(instance, "chmod +x /startup.sh", true);
  } catch (error) {
    console.log("No startup.sh found in project, creating basic one");
    const basicStartup = `#!/bin/sh
supervisord -c /etc/supervisor/supervisord.conf
wait-for-docker.sh
cd /builtins
NODE_ENV=production WORKER_PORT=39377 node /builtins/build/index.js`;
    
    await runSSHCommand(
      instance,
      `cat > /startup.sh << 'EOF'
${basicStartup}
EOF`,
      true
    );
    await runSSHCommand(instance, "chmod +x /startup.sh", true);
  }

  // Copy prompt-wrapper.sh if it exists
  const promptWrapperPath = path.join(__dirname, "..", "prompt-wrapper.sh");
  try {
    const promptContent = await fs.readFile(promptWrapperPath, "utf-8");
    await runSSHCommand(
      instance,
      `cat > /usr/local/bin/prompt-wrapper << 'EOF'
${promptContent}
EOF`,
      true
    );
    await runSSHCommand(instance, "chmod +x /usr/local/bin/prompt-wrapper", true);
  } catch (error) {
    console.log("No prompt-wrapper.sh found in project");
  }
}

async function testWorker(instance: Instance) {
  console.log("\n--- Testing worker ---");

  // Start the worker process in the background
  await runSSHCommand(
    instance,
    "cd /builtins && NODE_ENV=production WORKER_PORT=39377 nohup node /builtins/build/index.js > /tmp/worker.log 2>&1 &",
    true
  );

  // Start OpenVSCode server in the background
  await runSSHCommand(
    instance,
    [
      "/app/openvscode-server/bin/openvscode-server",
      "--host 0.0.0.0",
      "--port 39378",
      "--without-connection-token",
      "--disable-workspace-trust",
      "--disable-telemetry",
      "--disable-updates",
      "--profile default-profile",
      "/root/workspace",
      "> /var/log/cmux/server.log 2>&1 &",
    ].join(" "),
    true
  );

  // Expose HTTP services
  await instance.exposeHttpService("worker", 39377);
  await instance.exposeHttpService("vscode", 39378);

  console.log("Worker started, services exposed");

  // Wait for local services to initialize
  console.log("Waiting for local worker and VSCode readiness...");
  for (let i = 0; i < 30; i++) {
    const workerReady = await runSSHCommand(
      instance,
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:39377/socket.io/?EIO=4&transport=polling || true",
      true,
      false
    );
    const vscodeReady = await runSSHCommand(
      instance,
      "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:39378/?folder=/root/workspace' || true",
      true,
      false
    );
    if (workerReady.stdout.includes("200") && vscodeReady.stdout.includes("200")) {
      console.log("Local services are ready");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Get the instance networking info to find the exposed URLs
  const client = new MorphCloudClient();
  const freshInstance = await client.instances.get({ instanceId: instance.id });

  let workerUrl: string | null = null;
  let vscodeUrl: string | null = null;
  for (const service of freshInstance.networking.httpServices) {
    if (service.name === "worker") {
      workerUrl = service.url;
    } else if (service.name === "vscode") {
      vscodeUrl = service.url + "/?folder=/root/workspace";
    }
  }

  if (!workerUrl) {
    console.log("Warning: Could not find worker URL for testing");
    return;
  }

  console.log("Worker URL:", workerUrl);
  if (vscodeUrl) {
    console.log("VSCode URL:", vscodeUrl);
  }

  // Basic external connectivity tests
  try {
    const response = await fetch(`${workerUrl}/api/health`).catch(() => fetch(workerUrl));
    console.log(`Worker responded with status: ${response.status}`);
  } catch (error) {
    console.log("Worker connectivity test failed:", error);
  }

  // Test socket.io polling endpoint
  try {
    const sio = await fetch(`${workerUrl}/socket.io/?EIO=4&transport=polling`);
    console.log(`Socket.io polling responded with status: ${sio.status}`);
  } catch (error) {
    console.log("Socket.io polling test failed:", error);
  }

  // Test OpenVSCode external URL if available
  if (vscodeUrl) {
    try {
      const vs = await fetch(vscodeUrl);
      console.log(`VSCode responded with status: ${vs.status}`);
    } catch (error) {
      console.log("VSCode connectivity test failed:", error);
    }
  }
}

async function main() {
  try {
    const client = new MorphCloudClient();

    // Configuration
    const VCPUS = 4;
    const MEMORY = 8192; // Increased memory for build process
    const DISK_SIZE = 16384; // Increased disk size

    console.log("Creating initial snapshot from morphvm-minimal...");
    const initialSnapshot = await client.snapshots.create({
      imageId: "morphvm-minimal", // Use known-good minimal image
      vcpus: VCPUS,
      memory: MEMORY,
      diskSize: DISK_SIZE,
    });

    console.log(`Starting instance from snapshot ${initialSnapshot.id}...`);
    const instance = await client.instances.start({
      snapshotId: initialSnapshot.id,
    });

    // Wait for instance to be ready
    await instance.waitUntilReady();

    try {
      // Set up the base environment
      await setupBaseEnvironment(instance);
      
      // Install Node.js and Bun
      await installNodeAndBun(instance);
      
      // Install Docker
      await installDocker(instance);
      
      // Install additional tools
      await installAdditionalTools(instance);
      
      // Install OpenVSCode Server
      await installOpenVSCode(instance);
      
      // Execute Dockerfile instructions
      await executeDockerfile(instance);
      
      // Create startup scripts
      await createStartupScripts(instance);
      
      // Test the worker
      await testWorker(instance);

      // Create final snapshot
      console.log("\n--- Creating final snapshot ---");
      const finalSnapshot = await instance.snapshot({
        metadata: {
          name: `cmux-worker-dockerfile-${Date.now()}`,
          description: "cmux worker built from Dockerfile using parser",
        },
      });

      console.log(`\n✅ Successfully created snapshot: ${finalSnapshot.id}`);
      console.log("\nTo use this snapshot:");
      console.log(
        `  const instance = await client.instances.start({ snapshotId: "${finalSnapshot.id}" });`
      );

      // Display instance information
      console.log("\nInstance Details:");
      console.log(`  ID: ${instance.id}`);
      console.log(`  Snapshot ID: ${finalSnapshot.id}`);
      console.log("\nHTTP Services:");
      const freshInstance = await client.instances.get({
        instanceId: instance.id,
      });
      for (const service of freshInstance.networking.httpServices) {
        console.log(`  ${service.name}: ${service.url}`);
      }
    } finally {
      // Stop the instance
      console.log("\nStopping instance...");
      await instance.stop();
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
