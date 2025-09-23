import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import type { AgentConfig } from "@cmux/shared";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VSCodeInstance } from "./vscode/VSCodeInstance";

const execFileAsync = promisify(execFile);

interface WorkerExecParams {
  workerSocket: unknown;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeout?: number;
}

interface WorkerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

interface FakeConvexClient {
  query: (route: unknown, args: unknown) => Promise<unknown>;
  mutation: (route: unknown, args: unknown) => Promise<unknown>;
}

const hoisted = vi.hoisted(() => {
  const serverLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const queryMock = vi.fn<FakeConvexClient["query"]>();
  const mutationMock = vi.fn<FakeConvexClient["mutation"]>();
  const workerExecMock = vi.fn<
    (params: WorkerExecParams) => Promise<WorkerExecResult>
  >();
  const generateCommitMessageFromDiffMock = vi.fn<
    (diff: string, teamSlugOrId: string) => Promise<string>
  >();

  return {
    serverLogger,
    queryMock,
    mutationMock,
    workerExecMock,
    generateCommitMessageFromDiffMock,
  } as const;
});

vi.mock("./utils/fileLogger.js", () => ({
  serverLogger: hoisted.serverLogger,
}));

vi.mock("./utils/workerExec", () => ({
  workerExec: hoisted.workerExecMock,
}));

vi.mock("./utils/commitMessageGenerator.js", () => ({
  generateCommitMessageFromDiff: hoisted.generateCommitMessageFromDiffMock,
}));

vi.mock("./utils/convexClient.js", () => ({
  getConvex: () => ({
    query: hoisted.queryMock,
    mutation: hoisted.mutationMock,
  } satisfies FakeConvexClient),
}));

const serverLogger = hoisted.serverLogger;
const queryMock = hoisted.queryMock;
const mutationMock = hoisted.mutationMock;
const workerExecMock = hoisted.workerExecMock;
const generateCommitMessageFromDiffMock = hoisted.generateCommitMessageFromDiffMock;

import performAutoCommitAndPush from "./performAutoCommitAndPush";

async function runGit(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function runGitBare(gitDir: string, ...args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync("git", ["--git-dir", gitDir, ...args]);
  return { stdout, stderr };
}

async function initRepoWithRemote(repoPath: string, remotePath: string): Promise<void> {
  await runGit(repoPath, "init");
  await runGit(repoPath, "config", "user.email", "dev@example.com");
  await runGit(repoPath, "config", "user.name", "Dev Test");
  await writeFile(join(repoPath, "initial.txt"), "initial\n");
  await runGit(repoPath, "add", "initial.txt");
  await runGit(repoPath, "commit", "-m", "initial commit");
  await runGit(repoPath, "branch", "-M", "main");
  await runGit(repoPath, "remote", "add", "origin", remotePath);
  await runGit(repoPath, "push", "-u", "origin", "main");
}

async function createBareRemote(prefix: string): Promise<string> {
  const remotePath = join(tmpdir(), `${prefix}-${Math.random().toString(36).slice(2)}.git`);
  await execFileAsync("git", ["init", "--bare", remotePath]);
  return remotePath;
}

async function createWorkspaceWithSingleRepo(): Promise<{
  workspacePath: string;
  remotePath: string;
}> {
  const workspacePath = await mkdtemp(join(tmpdir(), "cmux-perform-single-"));
  const remotePath = await createBareRemote("single-remote");
  await initRepoWithRemote(workspacePath, remotePath);
  await writeFile(join(workspacePath, "change.txt"), `change ${Date.now()}\n`);
  return { workspacePath, remotePath };
}

async function createWorkspaceWithNestedRepo(): Promise<{
  workspacePath: string;
  repoPath: string;
  remotePath: string;
}> {
  const workspacePath = await mkdtemp(join(tmpdir(), "cmux-perform-nested-"));
  const repoPath = join(workspacePath, "cmux");
  await mkdir(repoPath, { recursive: true });
  const remotePath = await createBareRemote("nested-remote");
  await initRepoWithRemote(repoPath, remotePath);
  await writeFile(join(repoPath, "nested-change.txt"), `change nested ${Date.now()}\n`);
  return { workspacePath, repoPath, remotePath };
}

async function createWorkspaceWithMultipleRepos(): Promise<{
  workspacePath: string;
  repos: Array<{
    name: string;
    repoPath: string;
    remotePath: string;
  }>;
}> {
  const workspacePath = await mkdtemp(join(tmpdir(), "cmux-perform-multi-"));
  const repoNames = ["repo1", "repo2"] as const;
  const repos: Array<{ name: string; repoPath: string; remotePath: string }> = [];

  for (const name of repoNames) {
    const repoPath = join(workspacePath, name);
    await mkdir(repoPath, { recursive: true });
    const remotePath = await createBareRemote(`${name}-remote`);
    await initRepoWithRemote(repoPath, remotePath);
    await writeFile(join(repoPath, `change-${name}.txt`), `change ${name} ${Date.now()}\n`);
    repos.push({ name, repoPath, remotePath });
  }

  return { workspacePath, repos };
}

function configureWorkerExec(workspacePath: string): void {
  workerExecMock.mockImplementation(async ({ command, args }) => {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: workspacePath,
        env: process.env,
        maxBuffer: 5 * 1024 * 1024,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number; message: string };
      return {
        stdout: execError.stdout ?? "",
        stderr: execError.stderr ?? "",
        exitCode: typeof execError.code === "number" ? execError.code : 1,
        error: execError.message,
      };
    }
  });
}

describe.sequential("performAutoCommitAndPush", () => {
  const cleanupTargets: string[] = [];

  beforeEach(() => {
    workerExecMock.mockReset();
    queryMock.mockReset();
    mutationMock.mockReset();
    generateCommitMessageFromDiffMock.mockReset();
    serverLogger.info.mockReset();
    serverLogger.warn.mockReset();
    serverLogger.error.mockReset();
    cleanupTargets.length = 0;
  });

  afterEach(async () => {
    for (const target of cleanupTargets.reverse()) {
      try {
        await rm(target, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it("commits and pushes changes when the workspace itself is a repo", async () => {
    const { workspacePath, remotePath } = await createWorkspaceWithSingleRepo();
    cleanupTargets.push(workspacePath, remotePath);

    const branchName = "feature/test-branch";
    const commitMessage = "Auto commit from diff";
    const taskRunId = "taskRun_abcd1234" as Id<"taskRuns">;
    const taskId = "task_def5678" as Id<"tasks">;

    configureWorkerExec(workspacePath);
    generateCommitMessageFromDiffMock.mockResolvedValue(commitMessage);

    const taskRunRecord = {
      _id: taskRunId,
      taskId,
      isCrowned: false,
      newBranch: branchName,
      crownReason: null,
      completedAt: Date.now(),
    };

    queryMock.mockResolvedValueOnce(taskRunRecord);
    queryMock.mockResolvedValue(null);

    const getWorkerSocket = vi.fn(() => ({}));
    const isWorkerConnected = vi.fn(() => true);
    const vscodeInstance = {
      getWorkerSocket,
      isWorkerConnected,
    } as unknown as VSCodeInstance;

    const agent: AgentConfig = {
      name: "TestAgent",
      command: "run",
      args: [],
    };

    await performAutoCommitAndPush(
      vscodeInstance,
      agent,
      taskRunId,
      "Implement feature",
      "team",
      "diff content"
    );

    expect(serverLogger.info).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalled();
    const firstQuery = queryMock.mock.calls[0];
    expect(firstQuery?.[1]).toEqual({ teamSlugOrId: "team", id: taskRunId });
    expect(getWorkerSocket).toHaveBeenCalledTimes(1);
    expect(isWorkerConnected).toHaveBeenCalledTimes(1);
    expect(workerExecMock).toHaveBeenCalledTimes(2);
    const detectionCall = workerExecMock.mock.calls[0]?.[0];
    const commitCall = workerExecMock.mock.calls[1]?.[0];
    expect(detectionCall?.command).toBe("bash");
    expect(detectionCall?.cwd).toBe("/root/workspace");
    expect(detectionCall?.args[0]).toBe("-lc");
    expect(detectionCall?.args[1]).toContain("find \"$current_dir\"");
    expect(commitCall?.command).toBe("bash");
    expect(commitCall?.cwd).toBe(workspacePath);
    expect(commitCall?.args[0]).toBe("-c");
    expect(commitCall?.args[1]).toContain("set -o pipefail;");

    const { stdout: logOutput } = await runGitBare(remotePath, "log", branchName, "-1", "--pretty=%B");
    expect(logOutput.trim()).toBe(commitMessage);

    const { stdout: treeOutput } = await runGitBare(remotePath, "ls-tree", branchName, "change.txt");
    expect(treeOutput).toContain("change.txt");

    expect(serverLogger.error).not.toHaveBeenCalled();
  }, 120_000);

  it("resolves nested git repositories inside the workspace", async () => {
    const { workspacePath, repoPath, remotePath } = await createWorkspaceWithNestedRepo();
    cleanupTargets.push(repoPath, remotePath, workspacePath);

    const branchName = "feature/nested-repo";
    const commitMessage = "Auto commit nested repo";
    const taskRunId = "taskRun_nested123" as Id<"taskRuns">;
    const taskId = "task_nested456" as Id<"tasks">;

    configureWorkerExec(workspacePath);
    generateCommitMessageFromDiffMock.mockResolvedValue(commitMessage);

    const taskRunRecord = {
      _id: taskRunId,
      taskId,
      isCrowned: false,
      newBranch: branchName,
      crownReason: null,
      completedAt: Date.now(),
    };

    queryMock.mockResolvedValueOnce(taskRunRecord);
    queryMock.mockResolvedValue(null);

    const getWorkerSocket = vi.fn(() => ({}));
    const isWorkerConnected = vi.fn(() => true);
    const vscodeInstance = {
      getWorkerSocket,
      isWorkerConnected,
    } as unknown as VSCodeInstance;

    const agent: AgentConfig = {
      name: "TestAgent",
      command: "run",
      args: [],
    };

    await performAutoCommitAndPush(
      vscodeInstance,
      agent,
      taskRunId,
      "Implement nested feature",
      "team",
      "diff content"
    );

    expect(workerExecMock).toHaveBeenCalledTimes(2);
    const commitCall = workerExecMock.mock.calls[1]?.[0];
    expect(commitCall?.cwd).toBe(repoPath);

    const { stdout: logOutput } = await runGitBare(remotePath, "log", branchName, "-1", "--pretty=%B");
    expect(logOutput.trim()).toBe(commitMessage);

    const { stdout: treeOutput } = await runGitBare(remotePath, "ls-tree", branchName, "nested-change.txt");
    expect(treeOutput).toContain("nested-change.txt");
  }, 120_000);

  it("commits and pushes changes for each repo inside the workspace", async () => {
    const { workspacePath, repos } = await createWorkspaceWithMultipleRepos();
    for (const repo of repos) {
      cleanupTargets.push(repo.repoPath, repo.remotePath);
    }
    cleanupTargets.push(workspacePath);

    const branchName = "feature/multi-repo";
    const commitMessage = "Auto commit across repos";
    const taskRunId = "taskRun_multi123" as Id<"taskRuns">;
    const taskId = "task_multi456" as Id<"tasks">;

    configureWorkerExec(workspacePath);
    generateCommitMessageFromDiffMock.mockResolvedValue(commitMessage);

    const taskRunRecord = {
      _id: taskRunId,
      taskId,
      isCrowned: false,
      newBranch: branchName,
      crownReason: null,
      completedAt: Date.now(),
    };

    queryMock.mockResolvedValueOnce(taskRunRecord);
    queryMock.mockResolvedValue(null);

    const getWorkerSocket = vi.fn(() => ({}));
    const isWorkerConnected = vi.fn(() => true);
    const vscodeInstance = {
      getWorkerSocket,
      isWorkerConnected,
    } as unknown as VSCodeInstance;

    const agent: AgentConfig = {
      name: "TestAgent",
      command: "run",
      args: [],
    };

    await performAutoCommitAndPush(
      vscodeInstance,
      agent,
      taskRunId,
      "Implement feature across repos",
      "team",
      "diff content"
    );

    expect(serverLogger.info).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalled();
    const firstQuery = queryMock.mock.calls[0];
    expect(firstQuery?.[1]).toEqual({ teamSlugOrId: "team", id: taskRunId });
    expect(getWorkerSocket).toHaveBeenCalledTimes(1);
    expect(isWorkerConnected).toHaveBeenCalledTimes(1);
    expect(workerExecMock).toHaveBeenCalledTimes(2);
    const detectionCall = workerExecMock.mock.calls[0]?.[0];
    const commitCall = workerExecMock.mock.calls[1]?.[0];
    expect(detectionCall?.command).toBe("bash");
    expect(detectionCall?.cwd).toBe("/root/workspace");
    expect(commitCall?.cwd).toBe("/root/workspace");

    for (const repo of repos) {
      const { stdout: logOutput } = await runGitBare(repo.remotePath, "log", branchName, "-1", "--pretty=%B");
      expect(logOutput.trim()).toBe(commitMessage);

      const { stdout: treeOutput } = await runGitBare(
        repo.remotePath,
        "ls-tree",
        branchName,
        `change-${repo.name}.txt`
      );
      expect(treeOutput).toContain(`change-${repo.name}.txt`);
    }

    expect(serverLogger.error).not.toHaveBeenCalled();
  }, 120_000);
});
