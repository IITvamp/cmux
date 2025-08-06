// VS Code Extension Socket.IO Events

export interface VSCodeServerToClientEvents {
  // Health check
  "vscode:pong": () => void;

  // Status updates
  "vscode:status": (data: {
    ready: boolean;
    message: string;
    workspaceFolders?: string[];
  }) => void;

  // Terminal events
  "vscode:terminal-created": (data: {
    terminalId: string;
    name: string;
    cwd: string;
  }) => void;

  "vscode:terminal-output": (data: {
    terminalId: string;
    data: string;
  }) => void;

  "vscode:terminal-closed": (data: { terminalId: string }) => void;

  // Command execution results
  "vscode:command-result": (data: {
    commandId: string;
    success: boolean;
    error?: string;
  }) => void;
}

export interface VSCodeClientToServerEvents {
  // Health check
  "vscode:ping": (callback: (data: { timestamp: number }) => void) => void;

  // Execute VS Code command
  "vscode:execute-command": (
    data: {
      command: string;
      args?: any[];
      workingDirectory?: string;
    },
    callback: (response: { success: boolean; result?: any; error?: string }) => void
  ) => void;

  // Execute shell command
  "vscode:exec-command": (
    data: {
      command: string;
      args?: string[];
      cwd?: string;
    },
    callback: (response: { success: boolean; result?: { stdout: string; stderr: string }; error?: string }) => void
  ) => void;

  // Auto-commit and push
  "vscode:auto-commit-push": (
    data: {
      branchName: string;
      commitMessage: string;
      agentName: string;
    },
    callback: (response: { success: boolean; message?: string; error?: string }) => void
  ) => void;

  // Create terminal
  "vscode:create-terminal": (
    data: {
      name?: string;
      command?: string;
    },
    callback: (response: { success: boolean; error?: string }) => void
  ) => void;

  // Get status
  "vscode:get-status": (
    callback: (data: {
      ready: boolean;
      workspaceFolders?: string[];
      extensions?: string[];
    }) => void
  ) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface VSCodeInterServerEvents {}

export interface VSCodeSocketData {
  clientId?: string;
}
