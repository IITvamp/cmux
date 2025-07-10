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
  taskId: z.string(),
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

// Git diff events
export const GitStatusRequestSchema = z.object({
  workspacePath: z.string(),
});

export const GitDiffRequestSchema = z.object({
  workspacePath: z.string(),
  filePath: z.string(),
});

export const GitFullDiffRequestSchema = z.object({
  workspacePath: z.string(),
});

export const GitFileSchema = z.object({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed']),
  additions: z.number(),
  deletions: z.number(),
});

export const DiffLineSchema = z.object({
  type: z.enum(['addition', 'deletion', 'context', 'header']),
  content: z.string(),
  lineNumber: z.object({
    old: z.number().optional(),
    new: z.number().optional(),
  }).optional(),
});

export const GitStatusResponseSchema = z.object({
  files: z.array(GitFileSchema),
  error: z.string().optional(),
});

export const GitDiffResponseSchema = z.object({
  path: z.string(),
  diff: z.array(DiffLineSchema),
  error: z.string().optional(),
});

export const GitFileChangedSchema = z.object({
  workspacePath: z.string(),
  filePath: z.string(),
});

export const GitFullDiffResponseSchema = z.object({
  diff: z.string(),
  error: z.string().optional(),
});

export const OpenInEditorSchema = z.object({
  editor: z.enum(['vscode', 'cursor', 'windsurf']),
  path: z.string(),
});

export const OpenInEditorErrorSchema = z.object({
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
export type GitStatusRequest = z.infer<typeof GitStatusRequestSchema>;
export type GitDiffRequest = z.infer<typeof GitDiffRequestSchema>;
export type GitFile = z.infer<typeof GitFileSchema>;
export type DiffLine = z.infer<typeof DiffLineSchema>;
export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;
export type GitDiffResponse = z.infer<typeof GitDiffResponseSchema>;
export type GitFileChanged = z.infer<typeof GitFileChangedSchema>;
export type GitFullDiffRequest = z.infer<typeof GitFullDiffRequestSchema>;
export type GitFullDiffResponse = z.infer<typeof GitFullDiffResponseSchema>;
export type OpenInEditor = z.infer<typeof OpenInEditorSchema>;
export type OpenInEditorError = z.infer<typeof OpenInEditorErrorSchema>;

// Socket.io event map types
export interface ClientToServerEvents {
  "create-terminal": (data: CreateTerminal) => void;
  "terminal-input": (data: TerminalInput) => void;
  resize: (data: Resize) => void;
  "close-terminal": (data: CloseTerminal) => void;
  "start-task": (data: StartTask, callback: (response: TaskStarted | TaskError) => void) => void;
  "git-status": (data: GitStatusRequest) => void;
  "git-diff": (data: GitDiffRequest) => void;
  "git-full-diff": (data: GitFullDiffRequest) => void;
  "open-in-editor": (data: OpenInEditor) => void;
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
  "git-status-response": (data: GitStatusResponse) => void;
  "git-diff-response": (data: GitDiffResponse) => void;
  "git-file-changed": (data: GitFileChanged) => void;
  "git-full-diff-response": (data: GitFullDiffResponse) => void;
  "open-in-editor-error": (data: OpenInEditorError) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {
  // No inter-server events in this application
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocketData {
  // Additional data attached to each socket
}
