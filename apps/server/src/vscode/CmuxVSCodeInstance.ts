import { getShortId } from "@cmux/shared";
import { getAuthHeaderJson, getAuthToken } from "../utils/requestContext.js";
import { dockerLogger } from "../utils/fileLogger.js";
import {
  VSCodeInstance,
  type VSCodeInstanceConfig,
  type VSCodeInstanceInfo,
} from "./VSCodeInstance.js";
// Note: avoid importing @cmux/www-openapi-client here to keep server bundle lean

export class CmuxVSCodeInstance extends VSCodeInstance {
  private sandboxId: string | null = null;
  private workerUrl: string | null = null;
  private vscodeBaseUrl: string | null = null;
  private provider: VSCodeInstanceInfo["provider"] = "morph";
  private repoUrl?: string;
  private branch?: string;
  private newBranch?: string;

  constructor(config: VSCodeInstanceConfig) {
    super(config);
    // Ensure www OpenAPI client has correct baseUrl
    // no-op
    const cfg = config as VSCodeInstanceConfig & {
      repoUrl?: string;
      branch?: string;
      newBranch?: string;
    };
    this.repoUrl = cfg.repoUrl;
    this.branch = cfg.branch;
    this.newBranch = cfg.newBranch;
  }

  async start(): Promise<VSCodeInstanceInfo> {
    const token = getAuthToken();
    dockerLogger.info(
      `[CmuxVSCodeInstance ${this.instanceId}] Requesting sandbox start via www API`
    );

    const baseUrl =
      process.env.WWW_API_BASE_URL || process.env.CMUX_WWW_API_URL || "http://localhost:9779";
    const startRes = await fetch(`${baseUrl}/api/sandboxes/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              "x-stack-auth":
                getAuthHeaderJson() || JSON.stringify({ accessToken: token }),
            }
          : {}),
      },
      body: JSON.stringify({
        teamSlugOrId: this.teamSlugOrId,
        ttlSeconds: 20 * 60,
        metadata: {
          instance: `cmux-${getShortId(this.taskRunId)}`,
          taskRunId: String(this.taskRunId),
          agentName: this.config.agentName || "",
        },
        ...(this.repoUrl
          ? {
              repoUrl: this.repoUrl,
              branch: this.branch,
              newBranch: this.newBranch,
              depth: 1,
            }
          : {}),
      }),
    });
    if (!startRes.ok) {
      const err = await startRes.text();
      throw new Error(`Failed to start sandbox: ${err}`);
    }
    const data = (await startRes.json()) as {
      instanceId: string;
      vscodeUrl: string;
      workerUrl: string;
      provider: VSCodeInstanceInfo["provider"];
    };

    this.sandboxId = data.instanceId;
    this.vscodeBaseUrl = data.vscodeUrl;
    this.workerUrl = data.workerUrl;
    this.provider = data.provider || "morph";

    const workspaceUrl = this.getWorkspaceUrl(this.vscodeBaseUrl);
    dockerLogger.info(`[CmuxVSCodeInstance] VS Code URL: ${workspaceUrl}`);
    dockerLogger.info(`[CmuxVSCodeInstance] Worker URL: ${this.workerUrl}`);

    // Connect to the worker if available
    if (this.workerUrl) {
      try {
        await this.connectToWorker(this.workerUrl);
        dockerLogger.info(
          `[CmuxVSCodeInstance ${this.instanceId}] Connected to worker`
        );
      } catch (error) {
        dockerLogger.error(
          `[CmuxVSCodeInstance ${this.instanceId}] Failed to connect to worker`,
          error
        );
      }
    }

    return {
      url: this.vscodeBaseUrl!,
      workspaceUrl,
      instanceId: this.instanceId,
      taskRunId: this.taskRunId,
      provider: this.provider,
    };
  }

  async stop(): Promise<void> {
    // Disconnect socket and ask www to stop
    await this.disconnectFromWorker();
    const token = getAuthToken();
    if (this.sandboxId) {
      try {
        const baseUrl =
          process.env.WWW_API_BASE_URL || process.env.CMUX_WWW_API_URL || "http://localhost:9779";
        await fetch(`${baseUrl}/api/sandboxes/${this.sandboxId}/stop`, {
          method: "POST",
          headers: {
            ...(token
              ? {
                  "x-stack-auth":
                    getAuthHeaderJson() || JSON.stringify({ accessToken: token }),
                }
              : {}),
          },
        });
      } catch (e) {
        dockerLogger.warn(`[CmuxVSCodeInstance] stop failed`, e);
      }
    }
    await this.baseStop();
  }

  async getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }> {
    const token = getAuthToken();
    if (!this.sandboxId) return { running: false };
    try {
      const baseUrl =
        process.env.WWW_API_BASE_URL || process.env.CMUX_WWW_API_URL || "http://localhost:9779";
      const res = await fetch(`${baseUrl}/api/sandboxes/${this.sandboxId}/status`, {
        headers: {
          ...(token
            ? {
                "x-stack-auth":
                  getAuthHeaderJson() || JSON.stringify({ accessToken: token }),
              }
            : {}),
        },
      });
      if (!res.ok) return { running: false };
      const st = (await res.json()) as {
        running: boolean;
        vscodeUrl?: string;
        workerUrl?: string;
        provider?: VSCodeInstanceInfo["provider"];
      };
      if (st.running && st.vscodeUrl) {
        return {
          running: true,
          info: {
            url: st.vscodeUrl,
            workspaceUrl: this.getWorkspaceUrl(st.vscodeUrl),
            instanceId: this.instanceId,
            taskRunId: this.taskRunId,
            provider: st.provider || this.provider,
          },
        };
      }
      return { running: false };
    } catch {
      return { running: false };
    }
  }

  // Bridge for agentSpawner to publish devcontainer networking (Morph-backed)
  async setupDevcontainer(): Promise<void> {
    const token = getAuthToken();
    if (!this.sandboxId) return;
    try {
      const baseUrl =
        process.env.WWW_API_BASE_URL || process.env.CMUX_WWW_API_URL || "http://localhost:9779";
      await fetch(`${baseUrl}/api/sandboxes/${this.sandboxId}/publish-devcontainer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? {
                "x-stack-auth":
                  getAuthHeaderJson() || JSON.stringify({ accessToken: token }),
              }
            : {}),
        },
        body: JSON.stringify({
          teamSlugOrId: this.teamSlugOrId,
          taskRunId: String(this.taskRunId),
        }),
      });
    } catch (e) {
      dockerLogger.warn(
        `[CmuxVSCodeInstance] setupDevcontainer failed for sandbox ${this.sandboxId}`,
        e
      );
    }
  }

  async hydrateRepo(params: {
    teamSlugOrId: string;
    repoUrl: string;
    branch?: string;
    newBranch?: string;
  }): Promise<void> {
    if (!this.sandboxId) return;
    const baseUrl =
      process.env.WWW_API_BASE_URL || process.env.CMUX_WWW_API_URL || "http://localhost:9779";
    const token = getAuthToken();
    const res = await fetch(`${baseUrl}/api/sandboxes/${this.sandboxId}/hydrate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              "x-stack-auth":
                getAuthHeaderJson() || JSON.stringify({ accessToken: token }),
            }
          : {}),
      },
      body: JSON.stringify({
        teamSlugOrId: params.teamSlugOrId,
        repoUrl: params.repoUrl,
        branch: params.branch,
        newBranch: params.newBranch,
        depth: 1,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      dockerLogger.error(
        `[CmuxVSCodeInstance] hydrateRepo failed: ${res.status} ${text}`
      );
      throw new Error(`Hydrate failed: ${res.status}`);
    }
  }

  getName(): string {
    return this.sandboxId || this.instanceId;
  }
}
