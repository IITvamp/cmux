import { z } from "zod";

// Client to Server Events
export const CreateTerminalSchema = z.object({
  id: z.string().optional(),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});

export const TerminalInputSchema = z.object({
  terminalId: z.string(),
  data: z.string(),
});

export const ResizeSchema = z.object({
  terminalId: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const CloseTerminalSchema = z.object({
  terminalId: z.string(),
});

export const StartTaskSchema = z.object({
  repoUrl: z.string(),
  branch: z.string().optional(),
  taskDescription: z.string(),
  projectFullName: z.string(),
});

// Server to Client Events
export const TerminalCreatedSchema = z.object({
  terminalId: z.string(),
});

export const TerminalOutputSchema = z.object({
  terminalId: z.string(),
  data: z.string(),
});

export const TerminalExitSchema = z.object({
  terminalId: z.string(),
  exitCode: z.number().int(),
  signal: z.number().int().optional(),
});

export const TerminalClosedSchema = z.object({
  terminalId: z.string(),
});

export const TerminalClearSchema = z.object({
  terminalId: z.string(),
});

export const TerminalRestoreSchema = z.object({
  terminalId: z.string(),
  data: z.string(),
});

export const TaskStartedSchema = z.object({
  taskId: z.string(),
  worktreePath: z.string(),
  terminalId: z.string(),
});

export const TaskErrorSchema = z.object({
  taskId: z.string(),
  error: z.string(),
});

// Type exports
export type CreateTerminal = z.infer<typeof CreateTerminalSchema>;
export type TerminalInput = z.infer<typeof TerminalInputSchema>;
export type Resize = z.infer<typeof ResizeSchema>;
export type CloseTerminal = z.infer<typeof CloseTerminalSchema>;
export type StartTask = z.infer<typeof StartTaskSchema>;
export type TerminalCreated = z.infer<typeof TerminalCreatedSchema>;
export type TerminalOutput = z.infer<typeof TerminalOutputSchema>;
export type TerminalExit = z.infer<typeof TerminalExitSchema>;
export type TerminalClosed = z.infer<typeof TerminalClosedSchema>;
export type TerminalClear = z.infer<typeof TerminalClearSchema>;
export type TerminalRestore = z.infer<typeof TerminalRestoreSchema>;
export type TaskStarted = z.infer<typeof TaskStartedSchema>;
export type TaskError = z.infer<typeof TaskErrorSchema>;

// Socket.io event map types
export interface ClientToServerEvents {
  "create-terminal": (data: CreateTerminal) => void;
  "terminal-input": (data: TerminalInput) => void;
  resize: (data: Resize) => void;
  "close-terminal": (data: CloseTerminal) => void;
  "start-task": (data: StartTask, callback: (response: TaskStarted | TaskError) => void) => void;
}

export interface ServerToClientEvents {
  "terminal-created": (data: TerminalCreated) => void;
  "terminal-output": (data: TerminalOutput) => void;
  "terminal-exit": (data: TerminalExit) => void;
  "terminal-closed": (data: TerminalClosed) => void;
  "terminal-clear": (data: TerminalClear) => void;
  "terminal-restore": (data: TerminalRestore) => void;
  "task-started": (data: TaskStarted) => void;
  "task-error": (data: TaskError) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {
  // No inter-server events in this application
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocketData {
  // Additional data attached to each socket
}
