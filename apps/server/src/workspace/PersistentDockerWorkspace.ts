import { api } from "@cmux/convex/api";
import Docker from "dockerode";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import { DockerVSCodeInstance } from "../vscode/DockerVSCodeInstance";
import { getConvex } from "../utils/convexClient";
import { dockerLogger } from "../utils/fileLogger";
import { getAuthToken, runWithAuthToken } from "../utils/requestContext";
import type {
  RepoStatus,
  WorkspaceInfo,
  WorkspaceProvider,
} from "./WorkspaceProvider";
import { connectToWorkerManagement } from "@cmux/shared/socket";

export class PersistentDockerWorkspace
  extends EventEmitter
  implements WorkspaceProvider
{
  private containerName: string;
  private imageName: string;
  private container: Docker.Container | null = null;
  private authToken: string | undefined;
  private teamSlugOrId: string;
  private volumeName: string;
  private workerSocket: ReturnType<typeof connectToWorkerManagement> | null =
    null;

  constructor(config: { teamSlugOrId: string }) {
    super();
    this.teamSlugOrId = config.teamSlugOrId;
    this.containerName = `cmux-dashboard-workspace-${config.teamSlugOrId}`;
    this.volumeName = `cmux-workspace-${config.teamSlugOrId}`;
    this.imageName = process.env.WORKER_IMAGE_NAME || "cmux-worker:0.0.1";
    this.authToken = getAuthToken();
  }

  async start(): Promise<WorkspaceInfo> {
    dockerLogger.info(
      `Starting persistent dashboard workspace: ${this.containerName}`
    );

    const docker = DockerVSCodeInstance.getDocker();

    await this.ensureImageExists(docker);
    await this.ensureVolumeExists(docker);

    const existingContainer = await this.getExistingContainer(docker);
    if (existingContainer) {
      const info = await existingContainer.inspect();
      if (info.State.Running) {
        dockerLogger.info(
          `Dashboard workspace ${this.containerName} is already running`
        );
        this.container = existingContainer;
        return this.getWorkspaceInfoFromContainer(info);
      }

      dockerLogger.info(
        `Restarting existing dashboard workspace ${this.containerName}`
      );
      await existingContainer.start();
      this.container = existingContainer;
      const updatedInfo = await existingContainer.inspect();
      const workspaceInfo = this.getWorkspaceInfoFromContainer(updatedInfo);
      await this.connectToWorker(workspaceInfo.workerUrl);
      await this.updateConvexWorkspace(workspaceInfo, "running");
      return workspaceInfo;
    }

    dockerLogger.info(
      `Creating new dashboard workspace container: ${this.containerName}`
    );

    const envVars = ["NODE_ENV=production", "WORKER_PORT=39377"];

    const createOptions: Docker.ContainerCreateOptions = {
      name: this.containerName,
      Image: this.imageName,
      Env: envVars,
      HostConfig: {
        AutoRemove: false,
        Privileged: true,
        PortBindings: {
          "39378/tcp": [{ HostPort: "0" }],
          "39377/tcp": [{ HostPort: "0" }],
          "39376/tcp": [{ HostPort: "0" }],
        },
        Binds: [
          `${this.volumeName}:/workspaces`,
          ...await this.getAdditionalMounts(),
        ],
      },
      ExposedPorts: {
        "39378/tcp": {},
        "39377/tcp": {},
        "39376/tcp": {},
      },
    };

    this.container = await docker.createContainer(createOptions);
    dockerLogger.info(`Container created: ${this.container.id}`);

    await this.container.start();
    dockerLogger.info(`Container started`);

    const containerInfo = await this.container.inspect();
    const workspaceInfo = this.getWorkspaceInfoFromContainer(containerInfo);

    await this.connectToWorker(workspaceInfo.workerUrl);
    await this.updateConvexWorkspace(workspaceInfo, "running");

    return workspaceInfo;
  }

  async stop(): Promise<void> {
    dockerLogger.info(
      `Stopping persistent dashboard workspace: ${this.containerName}`
    );

    if (this.workerSocket) {
      this.workerSocket.disconnect();
      this.workerSocket = null;
    }

    if (this.container) {
      try {
        await this.container.stop();
        dockerLogger.info(`Container ${this.containerName} stopped`);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode !== 304) {
          dockerLogger.error(
            `Error stopping container ${this.containerName}:`,
            error
          );
        }
      }
    }

    await this.updateConvexWorkspace(null, "stopped");
  }

  async getStatus(): Promise<{ running: boolean; info?: WorkspaceInfo }> {
    try {
      const docker = DockerVSCodeInstance.getDocker();
      if (!this.container) {
        const existingContainer = await this.getExistingContainer(docker);
        if (!existingContainer) {
          return { running: false };
        }
        this.container = existingContainer;
      }

      const containerInfo = await this.container.inspect();
      const running = containerInfo.State.Running;

      if (running) {
        const workspaceInfo = this.getWorkspaceInfoFromContainer(containerInfo);
        return { running: true, info: workspaceInfo };
      }

      return { running };
    } catch (_error) {
      return { running: false };
    }
  }

  async cloneRepo(
    repoUrl: string,
    repoName: string,
    branch?: string
  ): Promise<void> {
    if (!this.workerSocket) {
      throw new Error("Worker not connected");
    }

    dockerLogger.info(`Cloning repo ${repoUrl} to ${repoName}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Clone operation timed out"));
      }, 60000);

      this.workerSocket!.emit(
        "workspace:clone-repo",
        {
          repoUrl,
          repoName,
          branch,
        },
        (response: { success: boolean; error?: string }) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to clone repository"));
          }
        }
      );
    });
  }

  async switchRepo(repoName: string): Promise<void> {
    if (!this.workerSocket) {
      throw new Error("Worker not connected");
    }

    dockerLogger.info(`Switching to repo ${repoName}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Switch operation timed out"));
      }, 10000);

      this.workerSocket!.emit(
        "workspace:switch-repo",
        { repoName },
        (response: { success: boolean; error?: string }) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to switch repository"));
          }
        }
      );
    });
  }

  async fetchRepo(repoName: string): Promise<void> {
    if (!this.workerSocket) {
      throw new Error("Worker not connected");
    }

    dockerLogger.info(`Fetching repo ${repoName}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Fetch operation timed out"));
      }, 60000);

      this.workerSocket!.emit(
        "workspace:fetch-repo",
        { repoName },
        (response: { success: boolean; error?: string }) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to fetch repository"));
          }
        }
      );
    });
  }

  async getRepoStatus(repoName: string): Promise<RepoStatus> {
    if (!this.workerSocket) {
      throw new Error("Worker not connected");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Status operation timed out"));
      }, 10000);

      this.workerSocket!.emit(
        "workspace:repo-status",
        { repoName },
        (
          response:
            | {
              success: true;
              status: RepoStatus;
            }
            | { success: false; error: string }
        ) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve(response.status);
          } else {
            reject(new Error(response.error || "Failed to get repository status"));
          }
        }
      );
    });
  }

  async listRepos(): Promise<string[]> {
    if (!this.workerSocket) {
      throw new Error("Worker not connected");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("List operation timed out"));
      }, 10000);

      this.workerSocket!.emit(
        "workspace:list-repos",
        {},
        (response: { success: boolean; repos?: string[]; error?: string }) => {
          clearTimeout(timeout);
          if (response.success && response.repos) {
            resolve(response.repos);
          } else {
            reject(new Error(response.error || "Failed to list repositories"));
          }
        }
      );
    });
  }

  async removeRepo(repoName: string): Promise<void> {
    if (!this.workerSocket) {
      throw new Error("Worker not connected");
    }

    dockerLogger.info(`Removing repo ${repoName}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Remove operation timed out"));
      }, 30000);

      this.workerSocket!.emit(
        "workspace:remove-repo",
        { repoName },
        (response: { success: boolean; error?: string }) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to remove repository"));
          }
        }
      );
    });
  }

  private async ensureImageExists(docker: Docker): Promise<void> {
    try {
      await docker.getImage(this.imageName).inspect();
      dockerLogger.info(`Image ${this.imageName} found locally`);
    } catch (_error) {
      dockerLogger.info(
        `Image ${this.imageName} not found locally, pulling...`
      );

      try {
        const stream = await docker.pull(this.imageName);
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(
            stream,
            (err: Error | null, res: unknown[]) => {
              if (err) {
                reject(err);
              } else {
                resolve(res);
              }
            }
          );
        });
        dockerLogger.info(`Successfully pulled image ${this.imageName}`);
      } catch (pullError) {
        throw new Error(
          `Failed to pull Docker image ${this.imageName}: ${pullError}`
        );
      }
    }
  }

  private async ensureVolumeExists(docker: Docker): Promise<void> {
    try {
      await docker.getVolume(this.volumeName).inspect();
      dockerLogger.info(`Volume ${this.volumeName} already exists`);
    } catch (_error) {
      dockerLogger.info(`Creating volume ${this.volumeName}`);
      await docker.createVolume({ Name: this.volumeName });
    }
  }

  private async getExistingContainer(
    docker: Docker
  ): Promise<Docker.Container | null> {
    const containers = await docker.listContainers({
      all: true,
      filters: { name: [this.containerName] },
    });

    if (containers.length === 0) {
      return null;
    }

    return docker.getContainer(containers[0].Id);
  }

  private getWorkspaceInfoFromContainer(
    containerInfo: Docker.ContainerInspectInfo
  ): WorkspaceInfo {
    const ports = containerInfo.NetworkSettings.Ports;
    const vscodePort = ports["39378/tcp"]?.[0]?.HostPort;
    const workerPort = ports["39377/tcp"]?.[0]?.HostPort;

    if (!vscodePort || !workerPort) {
      throw new Error("Failed to get port mappings from container");
    }

    const baseUrl = `http://localhost:${vscodePort}`;
    const workspaceUrl = `${baseUrl}/?folder=/workspaces`;
    const workerUrl = `http://localhost:${workerPort}`;

    return {
      workspaceId: this.containerName,
      vscodeUrl: baseUrl,
      workerUrl,
      workspaceUrl,
      provider: "docker",
    };
  }

  private async getAdditionalMounts(): Promise<string[]> {
    const binds: string[] = [];

    const homeDir = os.homedir();
    const sshDir = path.join(homeDir, ".ssh");
    const gitConfigPath = path.join(homeDir, ".gitconfig");

    try {
      await fs.promises.access(sshDir);
      binds.push(`${sshDir}:/root/.ssh:ro`);
      dockerLogger.info(`SSH mount: ${sshDir} -> /root/.ssh (read-only)`);
    } catch {
      dockerLogger.info(`No SSH directory found at ${sshDir}`);
    }

    try {
      await fs.promises.access(gitConfigPath);
      binds.push(`${gitConfigPath}:/root/.gitconfig:ro`);
      dockerLogger.info(
        `Git config mount: ${gitConfigPath} -> /root/.gitconfig (read-only)`
      );
    } catch {
      dockerLogger.info(`No git config found at ${gitConfigPath}`);
    }

    return binds;
  }

  private async connectToWorker(workerUrl: string): Promise<void> {
    dockerLogger.info(`Connecting to worker at ${workerUrl}`);

    return new Promise((resolve, reject) => {
      this.workerSocket = connectToWorkerManagement({
        url: workerUrl,
        timeoutMs: 30_000,
        reconnectionAttempts: 10,
        forceNew: true,
      });

      this.workerSocket.on("connect", () => {
        dockerLogger.info(`Connected to dashboard workspace worker`);
        resolve();
      });

      this.workerSocket.on("connect_error", (error) => {
        dockerLogger.error(`Worker connection error:`, error.message);
        reject(error);
      });

      this.workerSocket.on("disconnect", (reason) => {
        dockerLogger.warn(`Disconnected from worker: ${reason}`);
      });
    });
  }

  private async updateConvexWorkspace(
    info: WorkspaceInfo | null,
    status: "starting" | "running" | "stopped"
  ): Promise<void> {
    try {
      await runWithAuthToken(this.authToken, async () => {
        await getConvex().mutation((api as any).dashboardWorkspaces.upsert, {
          teamSlugOrId: this.teamSlugOrId,
          provider: "docker",
          status,
          containerName: this.containerName,
          vscodeUrl: info?.vscodeUrl,
          workerUrl: info?.workerUrl,
          workspaceUrl: info?.workspaceUrl,
          volumePath: this.volumeName,
        });
      });
    } catch (error) {
      dockerLogger.error("Failed to update dashboard workspace in Convex:", error);
    }
  }
}
