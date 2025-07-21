import { EventEmitter } from "node:events";
import { io, type Socket } from "socket.io-client";
import type { ServerToWorkerEvents, WorkerToServerEvents } from "@coderouter/shared";

export interface VSCodeInstanceConfig {
  workspacePath?: string;
  initialCommand?: string;
  agentName?: string;
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
  protected workerSocket: Socket<WorkerToServerEvents, ServerToWorkerEvents> | null = null;
  protected workerConnected: boolean = false;

  constructor(config: VSCodeInstanceConfig) {
    super();
    this.config = config;
    this.instanceId = crypto.randomUUID();
  }

  abstract start(): Promise<VSCodeInstanceInfo>;
  abstract stop(): Promise<void>;
  abstract getStatus(): Promise<{ running: boolean; info?: VSCodeInstanceInfo }>;
  
  async connectToWorker(workerUrl: string): Promise<void> {
    console.log(`[VSCodeInstance ${this.instanceId}] Connecting to worker at ${workerUrl}`);
    
    return new Promise((resolve, reject) => {
      this.workerSocket = io(`${workerUrl}/management`, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
      
      this.workerSocket.on('connect', () => {
        console.log(`[VSCodeInstance ${this.instanceId}] Connected to worker`);
        this.workerConnected = true;
        this.emit('worker-connected');
        resolve();
      });
      
      this.workerSocket.on('disconnect', () => {
        console.log(`[VSCodeInstance ${this.instanceId}] Disconnected from worker`);
        this.workerConnected = false;
        this.emit('worker-disconnected');
      });
      
      this.workerSocket.on('connect_error', (error) => {
        console.error(`[VSCodeInstance ${this.instanceId}] Worker connection error:`, error.message);
        reject(error);
      });
      
      // Set up worker event handlers
      this.workerSocket.on('worker:terminal-created', (data) => {
        console.log(`[VSCodeInstance ${this.instanceId}] Terminal created:`, data);
        this.emit('terminal-created', data);
      });
      
      this.workerSocket.on('worker:terminal-output', (data) => {
        this.emit('terminal-output', data);
      });
      
      this.workerSocket.on('worker:terminal-exit', (data) => {
        console.log(`[VSCodeInstance ${this.instanceId}] Terminal exited:`, data);
        this.emit('terminal-exit', data);
      });
      
      this.workerSocket.on('worker:error', (data) => {
        console.error(`[VSCodeInstance ${this.instanceId}] Worker error:`, data);
        this.emit('worker-error', data);
      });
    });
  }
  
  getWorkerSocket(): Socket<WorkerToServerEvents, ServerToWorkerEvents> | null {
    return this.workerSocket;
  }
  
  isWorkerConnected(): boolean {
    return this.workerConnected;
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  protected getWorkspaceUrl(baseUrl: string): string {
    return `${baseUrl}/?folder=/root/workspace`;
  }
  
  protected async disconnectFromWorker(): Promise<void> {
    if (this.workerSocket) {
      console.log(`[VSCodeInstance ${this.instanceId}] Disconnecting from worker`);
      this.workerSocket.disconnect();
      this.workerSocket = null;
      this.workerConnected = false;
    }
  }
}