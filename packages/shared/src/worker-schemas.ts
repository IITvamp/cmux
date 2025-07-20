import { z } from "zod";

// Worker Registration
export const WorkerRegisterSchema = z.object({
  workerId: z.string(),
  capabilities: z.object({
    maxConcurrentTerminals: z.number().int().positive(),
    supportedLanguages: z.array(z.string()).optional(),
    gpuAvailable: z.boolean().optional(),
    memoryMB: z.number().int().positive(),
    cpuCores: z.number().int().positive(),
  }),
  containerInfo: z.object({
    image: z.string(),
    version: z.string(),
    platform: z.string(),
  }).optional(),
});

export const WorkerHeartbeatSchema = z.object({
  workerId: z.string(),
  timestamp: z.number(),
  stats: z.object({
    activeTerminals: z.number().int(),
    cpuUsage: z.number().min(0).max(100),
    memoryUsage: z.number().min(0).max(100),
  }),
});

// Terminal Routing
export const TerminalAssignmentSchema = z.object({
  terminalId: z.string(),
  workerId: z.string(),
  taskId: z.string().optional(),
});

// Worker Status
export const WorkerStatusSchema = z.object({
  workerId: z.string(),
  status: z.enum(['online', 'offline', 'busy', 'error']),
  lastSeen: z.number(),
});

// Terminal operation schemas for server<>worker communication
export const WorkerCreateTerminalSchema = z.object({
  terminalId: z.string(),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  taskId: z.string().optional(),
});

export const WorkerTerminalInputSchema = z.object({
  terminalId: z.string(),
  data: z.string(),
});

export const WorkerResizeTerminalSchema = z.object({
  terminalId: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const WorkerCloseTerminalSchema = z.object({
  terminalId: z.string(),
});

// Worker terminal event schemas
export const WorkerTerminalOutputSchema = z.object({
  workerId: z.string(),
  terminalId: z.string(),
  data: z.string(),
});

export const WorkerTerminalExitSchema = z.object({
  workerId: z.string(),
  terminalId: z.string(),
  exitCode: z.number().int(),
  signal: z.number().int().optional(),
});

export const WorkerTerminalCreatedSchema = z.object({
  workerId: z.string(),
  terminalId: z.string(),
});

export const WorkerTerminalClosedSchema = z.object({
  workerId: z.string(),
  terminalId: z.string(),
});

// File upload schema for authentication files
export const WorkerUploadFilesSchema = z.object({
  files: z.array(z.object({
    sourcePath: z.string(), // Path on host
    destinationPath: z.string(), // Path in container
    content: z.string(), // Base64 encoded file content
    mode: z.string().optional(), // File permissions (e.g., "644")
  })),
  terminalId: z.string().optional(), // Optional terminal context
});

// Server to Worker Events
export const ServerToWorkerCommandSchema = z.object({
  command: z.enum(['create-terminal', 'destroy-terminal', 'execute-command']),
  payload: z.any(),
});

// Type exports
export type WorkerRegister = z.infer<typeof WorkerRegisterSchema>;
export type WorkerHeartbeat = z.infer<typeof WorkerHeartbeatSchema>;
export type TerminalAssignment = z.infer<typeof TerminalAssignmentSchema>;
export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;
export type ServerToWorkerCommand = z.infer<typeof ServerToWorkerCommandSchema>;
export type WorkerCreateTerminal = z.infer<typeof WorkerCreateTerminalSchema>;
export type WorkerTerminalInput = z.infer<typeof WorkerTerminalInputSchema>;
export type WorkerResizeTerminal = z.infer<typeof WorkerResizeTerminalSchema>;
export type WorkerCloseTerminal = z.infer<typeof WorkerCloseTerminalSchema>;
export type WorkerTerminalOutput = z.infer<typeof WorkerTerminalOutputSchema>;
export type WorkerTerminalExit = z.infer<typeof WorkerTerminalExitSchema>;
export type WorkerTerminalCreated = z.infer<typeof WorkerTerminalCreatedSchema>;
export type WorkerTerminalClosed = z.infer<typeof WorkerTerminalClosedSchema>;
export type WorkerUploadFiles = z.infer<typeof WorkerUploadFilesSchema>;

// Socket.io event maps for Server <-> Worker communication
// Docker readiness response type
export interface DockerReadinessResponse {
  ready: boolean;
  message?: string;
}

export interface ServerToWorkerEvents {
  // Terminal operations from server to worker
  "worker:create-terminal": (data: WorkerCreateTerminal) => void;
  "worker:terminal-input": (data: WorkerTerminalInput) => void;
  "worker:resize-terminal": (data: WorkerResizeTerminal) => void;
  "worker:close-terminal": (data: WorkerCloseTerminal) => void;
  
  // File operations
  "worker:upload-files": (data: WorkerUploadFiles) => void;
  
  // Management events
  "worker:terminal-assignment": (data: TerminalAssignment) => void;
  "worker:command": (data: ServerToWorkerCommand) => void;
  "worker:shutdown": () => void;
  
  // Health check events with acknowledgment
  "worker:check-docker": (callback: (response: DockerReadinessResponse) => void) => void;
}

export interface WorkerToServerEvents {
  // Registration and health
  "worker:register": (data: WorkerRegister) => void;
  "worker:heartbeat": (data: WorkerHeartbeat) => void;
  
  // Terminal events from worker to server
  "worker:terminal-created": (data: WorkerTerminalCreated) => void;
  "worker:terminal-output": (data: WorkerTerminalOutput) => void;
  "worker:terminal-exit": (data: WorkerTerminalExit) => void;
  "worker:terminal-closed": (data: WorkerTerminalClosed) => void;
  
  // Error reporting
  "worker:error": (data: { workerId: string; error: string }) => void;
}

// For worker's internal socket server (client connections)
export interface WorkerSocketData {
  workerId: string;
  assignedTerminals: Set<string>;
}