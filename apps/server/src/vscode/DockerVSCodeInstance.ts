import Docker from "dockerode";
import os from "os";
import path from "path";
import { cleanupGitCredentials } from "../utils/dockerGitSetup.js";
import { getGitHubTokenFromKeychain } from "../utils/getGitHubToken.js";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance.js";

export class DockerVSCodeInstance extends VSCodeInstance {
  private containerName: string;
  private imageName: string;
  private docker: Docker;
  private container: Docker.Container | null = null;

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    this.containerName = `coderouter-vscode-${this.instanceId}`;
    this.imageName = "coderouter-worker:0.0.1";
    // Always use explicit socket path for consistency
    this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
  }

  async start(): Promise<VSCodeInstanceInfo> {
    console.log(`Starting Docker VSCode instance: ${this.containerName}`);
    console.log(`  Image: ${this.imageName}`);
    console.log(`  Workspace: ${this.config.workspacePath}`);
    console.log(`  Agent name: ${this.config.agentName}`);

    // Stop and remove any existing container with same name
    try {
      const existingContainer = this.docker.getContainer(this.containerName);
      const info = await existingContainer.inspect().catch(() => null);
      if (info) {
        console.log(`Removing existing container ${this.containerName}`);
        await existingContainer.stop().catch(() => {});
        await existingContainer.remove().catch(() => {});
      }
    } catch (_error) {
      // Container doesn't exist, which is fine
    }

    const envVars = ["NODE_ENV=production", "WORKER_PORT=2377"];

    // Create container configuration
    const createOptions: Docker.ContainerCreateOptions = {
      name: this.containerName,
      Image: this.imageName,
      Env: envVars,
      HostConfig: {
        AutoRemove: true,
        Privileged: true,
        PortBindings: {
          "2376/tcp": [{ HostPort: "0" }], // VS Code port
          "2377/tcp": [{ HostPort: "0" }], // Worker port
          "2378/tcp": [{ HostPort: "0" }], // Extension socket port
        },
      },
      ExposedPorts: {
        "2376/tcp": {},
        "2377/tcp": {},
        "2378/tcp": {},
      },
    };

    // Add volume mount if workspace path is provided
    if (this.config.workspacePath) {
      // Extract the origin path from the workspace path
      // Workspace path is like: ~/cmux/<repoName>/worktrees/<branchName>
      // Origin path is: ~/cmux/<repoName>/origin
      const pathParts = this.config.workspacePath.split("/");
      const worktreesIndex = pathParts.lastIndexOf("worktrees");

      if (worktreesIndex > 0) {
        // Build the origin path
        const originPath = [
          ...pathParts.slice(0, worktreesIndex),
          "origin",
        ].join("/");

        // Get the user's home directory for git config
        const homeDir = os.homedir();
        const gitConfigPath = path.join(homeDir, ".gitconfig");

        const binds = [
          `${this.config.workspacePath}:/root/workspace`,
          // Mount the origin directory at the same absolute path to preserve git references
          `${originPath}:${originPath}:rw`, // Read-write mount for git operations
        ];

        // Mount SSH directory for git authentication
        const sshDir = path.join(homeDir, ".ssh");
        try {
          const fs = await import("fs");
          await fs.promises.access(sshDir);
          binds.push(`${sshDir}:/root/.ssh:ro`);
          console.log(`  SSH mount: ${sshDir} -> /root/.ssh (read-only)`);
        } catch {
          console.log(`  No SSH directory found at ${sshDir}`);
        }

        // Mount GitHub CLI config for authentication
        const ghConfigDir = path.join(homeDir, ".config", "gh");
        try {
          const fs = await import("fs");
          await fs.promises.access(ghConfigDir);
          binds.push(`${ghConfigDir}:/root/.config/gh:ro`);
          console.log(
            `  GitHub CLI config mount: ${ghConfigDir} -> /root/.config/gh (read-only)`
          );
        } catch {
          console.log(`  No GitHub CLI config found at ${ghConfigDir}`);
        }

        // Mount git config if it exists
        try {
          const fs = await import("fs");
          await fs.promises.access(gitConfigPath);

          // Read and filter the git config to remove macOS-specific settings
          const gitConfigContent = await fs.promises.readFile(
            gitConfigPath,
            "utf8"
          );
          const filteredConfig = this.filterGitConfig(gitConfigContent);

          // Write filtered config to a temporary location
          const tempDir = path.join(os.tmpdir(), "coderouter-git-configs");
          await fs.promises.mkdir(tempDir, { recursive: true });
          const tempGitConfigPath = path.join(
            tempDir,
            `gitconfig-${this.instanceId}`
          );
          await fs.promises.writeFile(tempGitConfigPath, filteredConfig);

          binds.push(`${tempGitConfigPath}:/root/.gitconfig:ro`);
          console.log(
            `  Git config mount: ${tempGitConfigPath} -> /root/.gitconfig (filtered, read-only)`
          );
        } catch {
          // Git config doesn't exist, which is fine
          console.log(`  No git config found at ${gitConfigPath}`);
        }

        createOptions.HostConfig!.Binds = binds;

        console.log(
          `  Origin mount: ${originPath} -> ${originPath} (read-write)`
        );
      } else {
        // Fallback to just mounting the workspace
        const homeDir = os.homedir();
        const gitConfigPath = path.join(homeDir, ".gitconfig");

        const binds = [`${this.config.workspacePath}:/root/workspace`];

        // Mount SSH directory for git authentication
        const sshDir = path.join(homeDir, ".ssh");
        try {
          const fs = await import("fs");
          await fs.promises.access(sshDir);
          binds.push(`${sshDir}:/root/.ssh:ro`);
          console.log(`  SSH mount: ${sshDir} -> /root/.ssh (read-only)`);
        } catch {
          console.log(`  No SSH directory found at ${sshDir}`);
        }

        // Mount GitHub CLI config for authentication
        const ghConfigDir = path.join(homeDir, ".config", "gh");
        try {
          const fs = await import("fs");
          await fs.promises.access(ghConfigDir);
          binds.push(`${ghConfigDir}:/root/.config/gh:ro`);
          console.log(
            `  GitHub CLI config mount: ${ghConfigDir} -> /root/.config/gh (read-only)`
          );
        } catch {
          console.log(`  No GitHub CLI config found at ${ghConfigDir}`);
        }

        // Mount git config if it exists
        try {
          const fs = await import("fs");
          await fs.promises.access(gitConfigPath);

          // Read and filter the git config to remove macOS-specific settings
          const gitConfigContent = await fs.promises.readFile(
            gitConfigPath,
            "utf8"
          );
          const filteredConfig = this.filterGitConfig(gitConfigContent);

          // Write filtered config to a temporary location
          const tempDir = path.join(os.tmpdir(), "coderouter-git-configs");
          await fs.promises.mkdir(tempDir, { recursive: true });
          const tempGitConfigPath = path.join(
            tempDir,
            `gitconfig-${this.instanceId}`
          );
          await fs.promises.writeFile(tempGitConfigPath, filteredConfig);

          binds.push(`${tempGitConfigPath}:/root/.gitconfig:ro`);
          console.log(
            `  Git config mount: ${tempGitConfigPath} -> /root/.gitconfig (filtered, read-only)`
          );
        } catch {
          // Git config doesn't exist, which is fine
          console.log(`  No git config found at ${gitConfigPath}`);
        }

        createOptions.HostConfig!.Binds = binds;
      }
    }

    console.log(`Creating container...`);

    // Create and start the container
    this.container = await this.docker.createContainer(createOptions);
    console.log(`Container created: ${this.container.id}`);

    await this.container.start();
    console.log(`Container started`);

    // Get container info including port mappings
    const containerInfo = await this.container.inspect();
    const ports = containerInfo.NetworkSettings.Ports;

    const vscodePort = ports["2376/tcp"]?.[0]?.HostPort;
    const workerPort = ports["2377/tcp"]?.[0]?.HostPort;

    if (!vscodePort) {
      console.error(`Available ports:`, ports);
      throw new Error("Failed to get VS Code port mapping for port 2376");
    }

    if (!workerPort) {
      console.error(`Available ports:`, ports);
      throw new Error("Failed to get worker port mapping for port 2377");
    }

    // Wait for worker to be ready by polling
    console.log(`Waiting for worker to be ready on port ${workerPort}...`);
    const maxAttempts = 30; // 15 seconds max
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(
          `http://localhost:${workerPort}/socket.io/?EIO=4&transport=polling`
        );
        if (response.ok) {
          console.log(`Worker is ready!`);
          break;
        }
      } catch {
        // Connection refused, worker not ready yet
      }

      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.warn("Worker may not be fully ready, but continuing...");
      }
    }

    const baseUrl = `http://localhost:${vscodePort}`;
    const workspaceUrl = this.getWorkspaceUrl(baseUrl);
    const workerUrl = `http://localhost:${workerPort}`;

    console.log(`Docker VSCode instance started:`);
    console.log(`  VS Code URL: ${workspaceUrl}`);
    console.log(`  Worker URL: ${workerUrl}`);

    // Monitor container events
    this.setupContainerEventMonitoring();

    // Connect to the worker
    try {
      await this.connectToWorker(workerUrl);
      console.log(
        `Successfully connected to worker for container ${this.containerName}`
      );

      // Configure git in the worker
      await this.configureGitInWorker();
    } catch (error) {
      console.error(
        `Failed to connect to worker for container ${this.containerName}:`,
        error
      );
      // Continue anyway - the instance is running even if we can't connect to the worker
    }

    return {
      url: baseUrl,
      workspaceUrl,
      instanceId: this.instanceId,
      provider: "docker",
    };
  }

  private setupContainerEventMonitoring() {
    if (!this.container) return;

    // Monitor container events
    this.container.wait((err: Error | null, data: { StatusCode: number }) => {
      if (err) {
        console.error(`Container wait error:`, err);
      } else {
        console.log(
          `Container ${this.containerName} exited with status:`,
          data
        );
        this.emit("exit", data.StatusCode);
      }
    });

    // Attach to container streams for logs (only if DEBUG is enabled)
    if (process.env.DEBUG) {
      this.container.attach(
        { stream: true, stdout: true, stderr: true },
        (err: Error | null, stream?: NodeJS.ReadWriteStream) => {
          if (err) {
            console.error(`Failed to attach to container streams:`, err);
            return;
          }

          // Demultiplex the stream
          this.container!.modem.demuxStream(
            stream!,
            process.stdout,
            process.stderr
          );
        }
      );
    }
  }

  async stop(): Promise<void> {
    console.log(`Stopping Docker VSCode instance: ${this.containerName}`);

    // Disconnect from worker first
    await this.disconnectFromWorker();

    if (this.container) {
      try {
        await this.container.stop();
        console.log(`Container ${this.containerName} stopped`);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode !== 304) {
          // 304 means container already stopped
          console.error(
            `Error stopping container ${this.containerName}:`,
            error
          );
        }
      }
    }

    // Clean up temporary git config file
    try {
      const fs = await import("fs");
      const tempGitConfigPath = path.join(
        os.tmpdir(),
        "coderouter-git-configs",
        `gitconfig-${this.instanceId}`
      );
      await fs.promises.unlink(tempGitConfigPath);
      console.log(`Cleaned up temporary git config file`);
    } catch {
      // File might not exist, which is fine
    }

    // Clean up git credentials file if we created one
    await cleanupGitCredentials(this.instanceId);
  }

  async getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }> {
    try {
      if (!this.container) {
        // Try to find container by name
        const containers = await this.docker.listContainers({
          all: true,
          filters: { name: [this.containerName] },
        });

        if (containers.length > 0) {
          this.container = this.docker.getContainer(containers[0].Id);
        } else {
          return { running: false };
        }
      }

      const containerInfo = await this.container.inspect();
      const running = containerInfo.State.Running;

      if (running) {
        const ports = containerInfo.NetworkSettings.Ports;
        const vscodePort = ports["2376/tcp"]?.[0]?.HostPort;

        if (vscodePort) {
          const baseUrl = `http://localhost:${vscodePort}`;
          return {
            running: true,
            info: {
              url: baseUrl,
              workspaceUrl: this.getWorkspaceUrl(baseUrl),
              instanceId: this.instanceId,
              provider: "docker",
            },
          };
        }
      }

      return { running };
    } catch (_error) {
      return { running: false };
    }
  }

  async getLogs(tail = 100): Promise<string> {
    if (!this.container) {
      throw new Error("Container not initialized");
    }

    const stream = await this.container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    // Convert the stream to string
    const logs = stream.toString("utf8");
    return logs;
  }

  private filterGitConfig(gitConfigContent: string): string {
    // Filter out macOS-specific credential helpers and other incompatible settings
    const lines = gitConfigContent.split("\n");
    const filteredLines: string[] = [];
    let inCredentialSection = false;
    let skipNextLine = false;

    for (const line of lines) {
      // Skip continuation of previous line
      if (skipNextLine && line.match(/^\s+/)) {
        continue;
      }
      skipNextLine = false;

      // Check if we're entering a credential section
      if (line.trim().match(/^\[credential/)) {
        inCredentialSection = true;
        // Keep the section header but we'll filter its contents
        filteredLines.push(line);
        continue;
      }

      // Check if we're entering a new section
      if (line.trim().match(/^\[/) && inCredentialSection) {
        inCredentialSection = false;
      }

      // In credential section, only skip macOS/Windows specific helpers
      if (inCredentialSection) {
        if (
          line.trim().includes("helper = osxkeychain") ||
          line.trim().includes("helper = manager-core") ||
          line.trim().includes("helper = manager") ||
          line.trim().includes("helper = wincred")
        ) {
          skipNextLine = true; // Skip any continuation lines
          continue;
        }
      }

      // Skip specific problematic settings outside credential sections
      if (
        !inCredentialSection &&
        (line.trim().includes("credential.helper = osxkeychain") ||
          line.trim().includes("credential.helper = manager"))
      ) {
        continue;
      }

      filteredLines.push(line);
    }

    // Add store credential helper config if no credential section exists
    const hasCredentialSection = filteredLines.some((line) =>
      line.trim().match(/^\[credential/)
    );
    if (!hasCredentialSection) {
      filteredLines.push("");
      filteredLines.push("[credential]");
      filteredLines.push("\thelper = store");
    }

    return filteredLines.join("\n");
  }

  private async configureGitInWorker(): Promise<void> {
    const workerSocket = this.getWorkerSocket();
    if (!workerSocket) {
      console.warn("No worker socket available for git configuration");
      return;
    }

    try {
      // Get GitHub token from host
      const githubToken = await getGitHubTokenFromKeychain();

      // Read SSH keys if available
      const homeDir = os.homedir();
      const sshDir = path.join(homeDir, ".ssh");
      let sshKeys:
        | { privateKey?: string; publicKey?: string; knownHosts?: string }
        | undefined = undefined;

      try {
        const fs = await import("fs");
        const privateKeyPath = path.join(sshDir, "id_rsa");
        const publicKeyPath = path.join(sshDir, "id_rsa.pub");
        const knownHostsPath = path.join(sshDir, "known_hosts");

        sshKeys = {};

        try {
          const privateKey = await fs.promises.readFile(privateKeyPath);
          sshKeys.privateKey = privateKey.toString("base64");
        } catch {
          // Private key not found
        }

        try {
          const publicKey = await fs.promises.readFile(publicKeyPath);
          sshKeys.publicKey = publicKey.toString("base64");
        } catch {
          // Public key not found
        }

        try {
          const knownHosts = await fs.promises.readFile(knownHostsPath);
          sshKeys.knownHosts = knownHosts.toString("base64");
        } catch {
          // Known hosts not found
        }

        // Only include sshKeys if at least one key was found
        if (!sshKeys.privateKey && !sshKeys.publicKey && !sshKeys.knownHosts) {
          sshKeys = undefined;
        }
      } catch {
        // SSH directory not accessible
      }

      // Send git configuration to worker
      const gitConfig: Record<string, string> = {};
      const userName = await this.getGitConfigValue("user.name");
      const userEmail = await this.getGitConfigValue("user.email");
      
      if (userName) gitConfig["user.name"] = userName;
      if (userEmail) gitConfig["user.email"] = userEmail;
      
      workerSocket.emit("worker:configure-git", {
        githubToken: githubToken || undefined,
        gitConfig: Object.keys(gitConfig).length > 0 ? gitConfig : undefined,
        sshKeys,
      });

      console.log("Git configuration sent to worker");
    } catch (error) {
      console.error("Failed to configure git in worker:", error);
    }
  }

  private async getGitConfigValue(key: string): Promise<string | undefined> {
    try {
      const { execSync } = await import("child_process");
      const value = execSync(`git config --global ${key}`).toString().trim();
      return value || undefined;
    } catch {
      return undefined;
    }
  }
}
