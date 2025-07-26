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
  selectedAgents: z.array(z.string()).optional(),
  isCloudMode: z.boolean().optional().default(false),
  images: z.array(z.object({
    src: z.string(),
    fileName: z.string().optional(),
    altText: z.string(),
  })).optional(),
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
  status: z.enum(["added", "modified", "deleted", "renamed"]),
  additions: z.number(),
  deletions: z.number(),
});

export const DiffLineSchema = z.object({
  type: z.enum(["addition", "deletion", "context", "header"]),
  content: z.string(),
  lineNumber: z
    .object({
      old: z.number().optional(),
      new: z.number().optional(),
    })
    .optional(),
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
  editor: z.enum(["vscode", "cursor", "windsurf"]),
  path: z.string(),
});

export const OpenInEditorErrorSchema = z.object({
  error: z.string(),
});

// File listing events
export const ListFilesRequestSchema = z.object({
  repoUrl: z.string(),
  branch: z.string().optional(),
  pattern: z.string().optional(), // Optional glob pattern for filtering
});

export const FileInfoSchema = z.object({
  path: z.string(),
  name: z.string(),
  isDirectory: z.boolean(),
  relativePath: z.string(),
});

export const ListFilesResponseSchema = z.object({
  files: z.array(FileInfoSchema),
  error: z.string().optional(),
});

// VSCode instance events (used for notifications)
export const VSCodeSpawnedSchema = z.object({
  instanceId: z.string(),
  url: z.string(),
  workspaceUrl: z.string(),
  provider: z.enum(["docker", "morph", "daytona"]),
});

export const VSCodeErrorSchema = z.object({
  error: z.string(),
});

// GitHub events
export const GitHubFetchBranchesSchema = z.object({
  repo: z.string(),
});

export const GitHubBranchesResponseSchema = z.object({
  success: z.boolean(),
  branches: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export const GitHubReposResponseSchema = z.object({
  success: z.boolean(),
  repos: z
    .record(
      z.string(),
      z.array(
        z.object({
          fullName: z.string(),
          name: z.string(),
        })
      )
    )
    .optional(),
  error: z.string().optional(),
});

export const GitHubAuthResponseSchema = z.object({
  authStatus: z.string().optional(),
  whoami: z.string().optional(),
  home: z.string().optional(),
  ghConfig: z.string().optional(),
  processEnv: z
    .object({
      HOME: z.string().optional(),
      USER: z.string().optional(),
      GH_TOKEN: z.string(),
      GITHUB_TOKEN: z.string(),
    })
    .optional(),
  error: z.string().optional(),
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
export type ListFilesRequest = z.infer<typeof ListFilesRequestSchema>;
export type FileInfo = z.infer<typeof FileInfoSchema>;
export type ListFilesResponse = z.infer<typeof ListFilesResponseSchema>;
export type VSCodeSpawned = z.infer<typeof VSCodeSpawnedSchema>;
export type VSCodeError = z.infer<typeof VSCodeErrorSchema>;
export type GitHubFetchBranches = z.infer<typeof GitHubFetchBranchesSchema>;
export type GitHubBranchesResponse = z.infer<
  typeof GitHubBranchesResponseSchema
>;
export type GitHubReposResponse = z.infer<typeof GitHubReposResponseSchema>;
export type GitHubAuthResponse = z.infer<typeof GitHubAuthResponseSchema>;

// Socket.io event map types
export interface ClientToServerEvents {
  // Terminal operations
  "start-task": (
    data: StartTask,
    callback: (response: TaskStarted | TaskError) => void
  ) => void;
  "git-status": (data: GitStatusRequest) => void;
  "git-diff": (data: GitDiffRequest) => void;
  "git-full-diff": (data: GitFullDiffRequest) => void;
  "open-in-editor": (data: OpenInEditor) => void;
  "list-files": (data: ListFilesRequest) => void;
  // GitHub operations
  "github-test-auth": (
    callback: (response: GitHubAuthResponse) => void
  ) => void;
  "github-fetch-repos": (
    callback: (response: GitHubReposResponse) => void
  ) => void;
  "github-fetch-branches": (
    data: GitHubFetchBranches,
    callback: (response: GitHubBranchesResponse) => void
  ) => void;
}

export interface ServerToClientEvents {
  "task-started": (data: TaskStarted) => void;
  "task-error": (data: TaskError) => void;
  "git-status-response": (data: GitStatusResponse) => void;
  "git-diff-response": (data: GitDiffResponse) => void;
  "git-file-changed": (data: GitFileChanged) => void;
  "git-full-diff-response": (data: GitFullDiffResponse) => void;
  "open-in-editor-error": (data: OpenInEditorError) => void;
  "list-files-response": (data: ListFilesResponse) => void;
  "vscode-spawned": (data: VSCodeSpawned) => void;
  "vscode-error": (data: VSCodeError) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {
  // No inter-server events in this application
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocketData {
  // Additional data attached to each socket
}
