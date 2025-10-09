export interface WorkspaceInfo {
  workspaceId: string;
  vscodeUrl: string;
  workerUrl: string;
  workspaceUrl: string;
  provider: "docker" | "morph" | "daytona";
}

export interface RepoStatus {
  repoFullName: string;
  currentBranch: string;
  isDirty: boolean;
  uncommittedFiles: number;
}

export interface WorkspaceProvider {
  start(): Promise<WorkspaceInfo>;
  stop(): Promise<void>;
  getStatus(): Promise<{
    running: boolean;
    info?: WorkspaceInfo;
  }>;
  cloneRepo(repoUrl: string, repoName: string, branch?: string): Promise<void>;
  switchRepo(repoName: string): Promise<void>;
  fetchRepo(repoName: string): Promise<void>;
  getRepoStatus(repoName: string): Promise<RepoStatus>;
  listRepos(): Promise<string[]>;
  removeRepo(repoName: string): Promise<void>;
}
