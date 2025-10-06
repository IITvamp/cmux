import type { Id } from "@cmux/convex/dataModel";
import type { RpcTarget } from "capnweb";
import type {
  AggregatePullRequestSummary,
  PullRequestActionResult,
} from "./pull-request-state";
import type { ReplaceDiffEntry } from "./diff-types";

// Keep all the Zod schemas for validation - import them from socket-schemas
export * from "./socket-schemas";
export * from "./worker-schemas";
export * from "./vscode-schemas";

/**
 * Main Server RPC Interface
 * This replaces the ClientToServerEvents/ServerToClientEvents pattern
 */
export interface IMainServerRpc extends RpcTarget {
  // Task operations
  startTask(data: {
    repoUrl?: string;
    branch?: string;
    taskDescription: string;
    projectFullName: string;
    taskId: Id<"tasks">;
    selectedAgents?: string[];
    isCloudMode?: boolean;
    images?: Array<{
      src: string;
      fileName?: string;
      altText: string;
    }>;
    theme?: "dark" | "light" | "system";
    environmentId?: Id<"environments">;
  }): Promise<
    | { taskId: Id<"tasks">; worktreePath: string; terminalId: string }
    | { taskId: Id<"tasks">; error: string }
  >;

  // Git operations
  gitDiff(data: {
    headRef: string;
    baseRef?: string;
    repoFullName?: string;
    repoUrl?: string;
    originPathOverride?: string;
    includeContents?: boolean;
    maxBytes?: number;
    lastKnownBaseSha?: string;
    lastKnownMergeCommitSha?: string;
  }): Promise<
    | { ok: true; diffs: ReplaceDiffEntry[] }
    | { ok: false; error: string; diffs: [] }
  >;

  gitFullDiff(data: { workspacePath: string }): Promise<{
    diff: string;
    error?: string;
  }>;

  // Editor operations
  openInEditor(data: {
    editor:
      | "vscode"
      | "cursor"
      | "windsurf"
      | "finder"
      | "iterm"
      | "terminal"
      | "ghostty"
      | "alacritty"
      | "xcode";
    path: string;
  }): Promise<{ success: boolean; error?: string }>;

  listFiles(data: {
    repoPath?: string;
    environmentId?: Id<"environments">;
    branch?: string;
    pattern?: string;
  }): Promise<{
    files: Array<{
      path: string;
      name: string;
      isDirectory: boolean;
      relativePath: string;
      repoFullName?: string;
    }>;
    error?: string;
  }>;

  // GitHub operations
  githubTestAuth(): Promise<{
    authStatus?: string;
    whoami?: string;
    home?: string;
    ghConfig?: string;
    processEnv?: {
      HOME?: string;
      USER?: string;
      GH_TOKEN: string;
      GITHUB_TOKEN: string;
    };
    error?: string;
  }>;

  githubFetchRepos(data: { teamSlugOrId: string }): Promise<{
    success: boolean;
    repos?: Record<string, Array<{ fullName: string; name: string }>>;
    error?: string;
  }>;

  githubFetchBranches(data: {
    teamSlugOrId: string;
    repo: string;
  }): Promise<{
    success: boolean;
    branches: string[];
    error?: string;
  }>;

  githubCreateDraftPr(data: { taskRunId: Id<"taskRuns"> }): Promise<{
    success: boolean;
    results: PullRequestActionResult[];
    aggregate: AggregatePullRequestSummary;
    error?: string;
  }>;

  githubSyncPrState(data: { taskRunId: Id<"taskRuns"> }): Promise<{
    success: boolean;
    results: PullRequestActionResult[];
    aggregate: AggregatePullRequestSummary;
    error?: string;
  }>;

  githubMergeBranch(data: { taskRunId: Id<"taskRuns"> }): Promise<{
    success: boolean;
    merged?: boolean;
    commitSha?: string;
    error?: string;
  }>;

  // System operations
  rustGetTime(): Promise<{ ok: true; time: string } | { ok: false; error: string }>;

  getAvailableEditors(): Promise<{
    vscode?: boolean;
    cursor?: boolean;
    windsurf?: boolean;
    finder?: boolean;
    iterm?: boolean;
    terminal?: boolean;
    ghostty?: boolean;
    alacritty?: boolean;
    xcode?: boolean;
  }>;

  checkProviderStatus(): Promise<{
    success: boolean;
    providers?: Array<{
      name: string;
      isAvailable: boolean;
      missingRequirements?: string[];
    }>;
    dockerStatus?: {
      isRunning: boolean;
      version?: string;
      error?: string;
      workerImage?: {
        name: string;
        isAvailable: boolean;
        isPulling?: boolean;
      };
    };
    gitStatus?: {
      isAvailable: boolean;
      version?: string;
      remoteAccess?: boolean;
      error?: string;
    };
    githubStatus?: {
      isConfigured: boolean;
      hasToken: boolean;
      error?: string;
    };
    error?: string;
  }>;

  getDefaultRepo(): Promise<{
    repoFullName?: string;
    branch?: string;
    localPath?: string;
    error?: string;
  }>;

  archiveTask(data: { taskId: Id<"tasks"> }): Promise<{
    success: boolean;
    error?: string;
  }>;

  spawnFromComment(data: {
    url: string;
    page: string;
    pageTitle: string;
    nodeId: string;
    x: number;
    y: number;
    content: string;
    userId: string;
    commentId: Id<"comments">;
    profileImageUrl?: string;
    selectedAgents?: string[];
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
    devicePixelRatio?: number;
  }): Promise<{
    success: boolean;
    taskId?: Id<"tasks">;
    taskRunId?: string;
    worktreePath?: string;
    terminalId?: string;
    vscodeUrl?: string;
    error?: string;
  }>;
}

/**
 * Main Server Events (server-initiated)
 * These are events that the server pushes to clients
 */
export interface IMainServerEvents extends RpcTarget {
  onGitFileChanged(callback: (data: {
    workspacePath: string;
    filePath: string;
  }) => void): void;

  onVscodeSpawned(callback: (data: {
    instanceId: string;
    url: string;
    workspaceUrl: string;
    provider: "docker" | "morph" | "daytona";
  }) => void): void;

  onDefaultRepo(callback: (data: {
    repoFullName: string;
    branch?: string;
    localPath: string;
  }) => void): void;

  onAvailableEditors(callback: (data: {
    vscode?: boolean;
    cursor?: boolean;
    windsurf?: boolean;
    finder?: boolean;
    iterm?: boolean;
    terminal?: boolean;
    ghostty?: boolean;
    alacritty?: boolean;
    xcode?: boolean;
  }) => void): void;
}

/**
 * Worker Management RPC Interface
 * This replaces ServerToWorkerEvents/WorkerToServerEvents
 */
export interface IWorkerManagementRpc extends RpcTarget {
  // Terminal operations
  createTerminal(data: {
    terminalId: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
    taskId?: Id<"tasks">;
    taskRunId?: Id<"taskRuns">;
    agentModel?: string;
    authFiles?: Array<{
      destinationPath: string;
      contentBase64: string;
      mode?: string;
    }>;
    startupCommands?: string[];
  }): Promise<{
    workerId: string;
    terminalId: string;
  }>;

  terminalInput(data: { terminalId: string; data: string }): Promise<void>;

  // File operations
  uploadFiles(data: {
    files: Array<{
      sourcePath: string;
      destinationPath: string;
      content: string;
      mode?: string;
    }>;
    terminalId?: string;
  }): Promise<void>;

  // Git configuration
  configureGit(data: {
    githubToken?: string;
    gitConfig?: Record<string, string>;
    sshKeys?: {
      privateKey?: string;
      publicKey?: string;
      knownHosts?: string;
    };
  }): Promise<void>;

  // Execute commands
  exec(data: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    signal?: string;
  }>;

  // File watching
  startFileWatch(data: {
    taskRunId: Id<"taskRuns">;
    worktreePath: string;
  }): Promise<void>;

  stopFileWatch(data: { taskRunId: Id<"taskRuns"> }): Promise<void>;

  // Health check
  checkDocker(): Promise<{
    ready: boolean;
    message?: string;
  }>;

  shutdown(): Promise<void>;
}

/**
 * Worker Events (worker-initiated)
 */
export interface IWorkerEvents extends RpcTarget {
  onTerminalCreated(callback: (data: {
    workerId: string;
    terminalId: string;
  }) => void): void;

  onTerminalOutput(callback: (data: {
    workerId: string;
    terminalId: string;
    data: string;
  }) => void): void;

  onTerminalExit(callback: (data: {
    workerId: string;
    terminalId: string;
    exitCode: number;
    signal?: number;
  }) => void): void;

  onTerminalClosed(callback: (data: {
    workerId: string;
    terminalId: string;
  }) => void): void;

  onTerminalIdle(callback: (data: {
    workerId: string;
    terminalId: string;
    taskRunId?: Id<"taskRuns">;
    elapsedMs: number;
  }) => void): void;

  onTaskComplete(callback: (data: {
    workerId: string;
    taskRunId: Id<"taskRuns">;
    agentModel?: string;
    elapsedMs: number;
  }) => void): void;

  onTerminalFailed(callback: (data: {
    workerId: string;
    terminalId: string;
    taskRunId?: Id<"taskRuns">;
    errorMessage: string;
    elapsedMs?: number;
  }) => void): void;

  onFileChanges(callback: (data: {
    workerId: string;
    taskRunId: Id<"taskRuns">;
    changes: Array<{
      type: "added" | "modified" | "deleted";
      path: string;
      timestamp: number;
    }>;
    gitDiff: string;
    fileDiffs: Array<{
      path: string;
      type: "added" | "modified" | "deleted";
      oldContent: string;
      newContent: string;
      patch: string;
    }>;
    timestamp: number;
  }) => void): void;

  onError(callback: (data: { workerId: string; error: string }) => void): void;
}

/**
 * VSCode Extension RPC Interface
 */
export interface IVSCodeRpc extends RpcTarget {
  ping(): Promise<{ timestamp: number }>;

  createTerminal(data: {
    name?: string;
    command?: string;
  }): Promise<{ success: boolean; error?: string }>;

  getStatus(): Promise<{
    ready: boolean;
    workspaceFolders?: string[];
    extensions?: string[];
  }>;
}

/**
 * VSCode Extension Events
 */
export interface IVSCodeEvents extends RpcTarget {
  onPong(callback: () => void): void;

  onStatus(callback: (data: {
    ready: boolean;
    message: string;
    workspaceFolders?: string[];
  }) => void): void;

  onTerminalCreated(callback: (data: {
    terminalId: string;
    name: string;
    cwd: string;
  }) => void): void;

  onTerminalOutput(callback: (data: {
    terminalId: string;
    data: string;
  }) => void): void;

  onTerminalClosed(callback: (data: { terminalId: string }) => void): void;

  onCommandResult(callback: (data: {
    commandId: string;
    success: boolean;
    error?: string;
  }) => void): void;
}