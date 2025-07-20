import { execSync, spawn, type ChildProcess } from "node:child_process";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance.js";

export class DockerVSCodeInstance extends VSCodeInstance {
  private containerName: string;
  private imageName: string;
  private dockerProcess: ChildProcess | null = null;

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    this.containerName = `coderouter-vscode-${this.instanceId}`;
    this.imageName = "coderouter-worker:0.0.1";
  }

  async start(): Promise<VSCodeInstanceInfo> {
    console.log(`Starting Docker VSCode instance: ${this.containerName}`);
    console.log(`  Image: ${this.imageName}`);
    console.log(`  Workspace: ${this.config.workspacePath}`);
    console.log(`  Initial command: ${this.config.initialCommand}`);

    // Stop and remove any existing container with same name
    try {
      execSync(`docker stop ${this.containerName} 2>/dev/null || true`);
      execSync(`docker rm ${this.containerName} 2>/dev/null || true`);
    } catch (_error) {
      // Ignore errors if container doesn't exist
    }

    // Build docker run arguments
    const dockerArgs = [
      "run",
      "--rm",
      "--name",
      this.containerName,
      "--privileged",
      "-p",
      "0:2376", // Let Docker assign a random port
      "-p",
      "0:2377", // Worker port
      "-p",
      "0:2378", // VS Code extension socket
      "-e",
      "NODE_ENV=production",
      "-e",
      "WORKER_PORT=2377",
    ];

    // Add INITIAL_COMMAND if provided
    if (this.config.initialCommand) {
      dockerArgs.push("-e", `INITIAL_COMMAND=${this.config.initialCommand}`);
    }

    // Add volume mount if workspace path is provided
    if (this.config.workspacePath) {
      dockerArgs.push("-v", `${this.config.workspacePath}:/root/workspace`);
    }

    dockerArgs.push(this.imageName);

    console.log(`Running docker command: docker ${dockerArgs.join(" ")}`);

    this.dockerProcess = spawn("docker", dockerArgs, {
      stdio: "ignore",
    });

    this.dockerProcess.on("message", (message) => {
      console.log(`[${this.containerName}] message:`, message);
    });

    this.dockerProcess.on("error", (error) => {
      console.error(
        `Failed to start Docker container ${this.containerName}:`,
        error
      );
      this.emit("error", error);
    });

    this.dockerProcess.on("exit", (code) => {
      console.log(
        `Docker container ${this.containerName} exited with code ${code}`
      );
      this.emit("exit", code);
    });

    // Capture stdout/stderr for debugging
    if (this.dockerProcess.stdout) {
      this.dockerProcess.stdout.on("data", (data) => {
        console.log(`[${this.containerName}] stdout:`, data.toString());
      });
    }

    if (this.dockerProcess.stderr) {
      this.dockerProcess.stderr.on("data", (data) => {
        console.error(`[${this.containerName}] stderr:`, data.toString());
      });
    }

    console.log(`Waiting for container to be ready...`);
    // Wait for container to be ready and get port mappings
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get the assigned ports
    console.log(`Getting port mappings for container ${this.containerName}...`);
    let portsOutput: string;
    try {
      portsOutput = execSync(
        `docker inspect ${this.containerName} --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}{{$p}} -> {{(index $conf 0).HostPort}}{{println}}{{end}}{{end}}'`,
        { encoding: "utf8" }
      );
      console.log(`Port mappings:`, portsOutput);
    } catch (error) {
      console.error(
        `Failed to inspect container ${this.containerName}:`,
        error
      );
      throw new Error(`Failed to inspect container: ${error}`);
    }

    const portMap = new Map<string, string>();
    portsOutput.split("\n").forEach((line) => {
      const match = line.match(/(\d+)\/tcp -> (\d+)/);
      if (match) {
        portMap.set(match[1], match[2]);
      }
    });

    const vscodePort = portMap.get("2376");
    if (!vscodePort) {
      console.error(`Available ports:`, Array.from(portMap.entries()));
      throw new Error("Failed to get VS Code port mapping for port 2376");
    }

    const baseUrl = `http://localhost:${vscodePort}`;
    const workspaceUrl = this.getWorkspaceUrl(baseUrl);

    console.log(`Docker VSCode instance started at: ${workspaceUrl}`);

    return {
      url: baseUrl,
      workspaceUrl,
      instanceId: this.instanceId,
      provider: "docker",
    };
  }

  async stop(): Promise<void> {
    console.log(`Stopping Docker VSCode instance: ${this.containerName}`);
    try {
      execSync(`docker stop ${this.containerName}`);
    } catch (error) {
      console.error(`Error stopping container ${this.containerName}:`, error);
    }
  }

  async getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }> {
    try {
      const output = execSync(
        `docker ps --filter name=${this.containerName} --format "{{.Names}}"`,
        {
          encoding: "utf8",
        }
      );
      const running = output.trim() === this.containerName;

      if (running) {
        // Get port mappings for running container
        const portsOutput = execSync(
          `docker inspect ${this.containerName} --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}{{$p}} -> {{(index $conf 0).HostPort}}{{println}}{{end}}{{end}}'`,
          { encoding: "utf8" }
        );

        const portMap = new Map<string, string>();
        portsOutput.split("\n").forEach((line) => {
          const match = line.match(/(\d+)\/tcp -> (\d+)/);
          if (match) {
            portMap.set(match[1], match[2]);
          }
        });

        const vscodePort = portMap.get("2376");
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
}
