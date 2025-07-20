import { EventEmitter } from "node:events";

export interface VSCodeInstanceConfig {
  workspacePath?: string;
  initialCommand?: string;
}

export interface VSCodeInstanceInfo {
  url: string;
  workspaceUrl: string;
  instanceId: string;
  provider: "docker" | "morph" | "daytona";
}

export abstract class VSCodeInstance extends EventEmitter {
  protected config: VSCodeInstanceConfig;
  protected instanceId: string;

  constructor(config: VSCodeInstanceConfig) {
    super();
    this.config = config;
    this.instanceId = crypto.randomUUID();
  }

  abstract start(): Promise<VSCodeInstanceInfo>;
  abstract stop(): Promise<void>;
  abstract getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }>;

  getInstanceId(): string {
    return this.instanceId;
  }

  protected getWorkspaceUrl(baseUrl: string): string {
    return `${baseUrl}/?folder=/root/workspace`;
  }
}