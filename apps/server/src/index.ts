import {
  GitFullDiffRequestSchema,
  GitHubFetchBranchesSchema,
  ListFilesRequestSchema,
  OpenInEditorSchema,
  StartTaskSchema,
  type ClientToServerEvents,
  type FileInfo,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@coderouter/shared";
import * as fuzzysort from "fuzzysort";
import { minimatch } from "minimatch";
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { promisify } from "node:util";
import { Server } from "socket.io";
import { spawnAllAgents } from "./agentSpawner.js";
import { GitDiffManager } from "./gitDiff.js";
import { createProxyApp, setupWebSocketProxy } from "./proxyApp.js";
import { RepositoryManager } from "./repositoryManager.js";
import { waitForConvex } from "./utils/waitForConvex.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";
import { getWorktreePath } from "./workspace.js";
import { convex } from "./utils/convexClient.js";
import { api } from "@coderouter/convex/api";

await waitForConvex();

const execAsync = promisify(exec);

// Helper to execute commands with inherited environment
const execWithEnv = (command: string) => {
  // Use zsh to ensure we get the user's shell environment and gh auth
  return execAsync(`/bin/zsh -c '${command}'`, {
    env: {
      ...process.env,
    },
  });
};

// Helper functions for common GitHub API operations
const ghApi = {
  // Execute gh api command and return parsed output
  async exec(command: string): Promise<string> {
    const { stdout } = await execWithEnv(command);
    return stdout.trim();
  },

  // Get current user
  async getUser(): Promise<string> {
    return this.exec('gh api user --jq ".login"');
  },

  // Get user repos
  async getUserRepos(): Promise<string[]> {
    const output = await this.exec(
      'gh api user/repos --paginate --jq ".[].full_name"'
    );
    return output.split("\n").filter(Boolean);
  },

  // Get user organizations
  async getUserOrgs(): Promise<string[]> {
    const output = await this.exec('gh api user/orgs --jq ".[].login"');
    return output.split("\n").filter(Boolean);
  },

  // Get organization repos
  async getOrgRepos(org: string): Promise<string[]> {
    const output = await this.exec(
      `gh api orgs/${org}/repos --paginate --jq ".[].full_name"`
    );
    return output.split("\n").filter(Boolean);
  },

  // Get repo branches
  async getRepoBranches(repo: string): Promise<string[]> {
    const output = await this.exec(
      `gh api repos/${repo}/branches --paginate --jq ".[].name"`
    );
    return output.split("\n").filter(Boolean);
  },
};

// Git diff manager instance
const gitDiffManager = new GitDiffManager();

// Create Express proxy app
const proxyApp = createProxyApp();

// Create HTTP server with Express app
const httpServer = createServer(proxyApp);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Setup WebSocket proxy handling after Socket.IO initialization
setupWebSocketProxy(httpServer);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("start-task", async (data, callback) => {
    try {
      console.log("got data", data);
      const taskData = StartTaskSchema.parse(data);
      console.log("starting task!", taskData);

      // Use the taskId provided by the client
      const taskId = taskData.taskId;

      // Spawn all agents in parallel (each will create its own taskRun)
      const agentResults = await spawnAllAgents(taskId, {
        repoUrl: taskData.repoUrl,
        branch: taskData.branch,
        taskDescription: taskData.taskDescription,
        selectedAgents: taskData.selectedAgents,
        isCloudMode: taskData.isCloudMode,
      });

      // Check if at least one agent spawned successfully
      const successfulAgents = agentResults.filter((result) => result.success);
      if (successfulAgents.length === 0) {
        callback({
          taskId: "error",
          error: "Failed to spawn any agents",
        });
        return;
      }

      // Log results for debugging
      agentResults.forEach((result) => {
        if (result.success) {
          console.log(
            `Successfully spawned ${result.agentName} with terminal ${result.terminalId}`
          );
          if (result.vscodeUrl) {
            console.log(
              `VSCode URL for ${result.agentName}: ${result.vscodeUrl}`
            );
          }
        } else {
          console.error(`Failed to spawn ${result.agentName}: ${result.error}`);
        }
      });

      // Return the first successful agent's info (you might want to modify this to return all)
      const primaryAgent = successfulAgents[0];

      // Emit VSCode URL if available
      if (primaryAgent.vscodeUrl) {
        io.emit("vscode-spawned", {
          instanceId: primaryAgent.terminalId,
          url: primaryAgent.vscodeUrl.replace("/?folder=/root/workspace", ""),
          workspaceUrl: primaryAgent.vscodeUrl,
          provider: taskData.isCloudMode ? "morph" : "docker",
        });
      }

      // Set up file watching for git changes
      gitDiffManager.watchWorkspace(
        primaryAgent.worktreePath,
        (changedPath) => {
          io.emit("git-file-changed", {
            workspacePath: primaryAgent.worktreePath,
            filePath: changedPath,
          });
        }
      );

      callback({
        taskId,
        worktreePath: primaryAgent.worktreePath,
        terminalId: primaryAgent.terminalId,
      });
    } catch (error) {
      console.error("Error in start-task:", error);
      callback({
        taskId: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Keep old handlers for backwards compatibility but they're not used anymore
  socket.on("git-status", async () => {
    socket.emit("git-status-response", {
      files: [],
      error: "Not implemented - use git-full-diff instead",
    });
  });

  socket.on("git-diff", async () => {
    socket.emit("git-diff-response", {
      path: "",
      diff: [],
      error: "Not implemented - use git-full-diff instead",
    });
  });

  socket.on("git-full-diff", async (data) => {
    try {
      const { workspacePath } = GitFullDiffRequestSchema.parse(data);
      const diff = await gitDiffManager.getFullDiff(workspacePath);
      socket.emit("git-full-diff-response", { diff });
    } catch (error) {
      console.error("Error getting full git diff:", error);
      socket.emit("git-full-diff-response", {
        diff: "",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("open-in-editor", async (data) => {
    try {
      const { editor, path } = OpenInEditorSchema.parse(data);
      const { exec } = await import("child_process");

      let command: string;
      switch (editor) {
        case "vscode":
          command = `code "${path}"`;
          break;
        case "cursor":
          command = `cursor "${path}"`;
          break;
        case "windsurf":
          command = `windsurf "${path}"`;
          break;
        default:
          throw new Error(`Unknown editor: ${editor}`);
      }

      exec(command, (error) => {
        if (error) {
          console.error(`Error opening ${editor}:`, error);
          socket.emit("open-in-editor-error", {
            error: `Failed to open ${editor}: ${error.message}`,
          });
        } else {
          console.log(`Successfully opened ${path} in ${editor}`);
        }
      });
    } catch (error) {
      console.error("Error opening editor:", error);
      socket.emit("open-in-editor-error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("list-files", async (data) => {
    try {
      const { repoUrl, branch, pattern } = ListFilesRequestSchema.parse(data);

      // Get the origin path for this repository
      const worktreeInfo = await getWorktreePath({ repoUrl, branch });

      // Ensure directories exist
      await fs.mkdir(worktreeInfo.projectPath, { recursive: true });

      const repoManager = RepositoryManager.getInstance();

      // Ensure the repository is cloned/fetched with deduplication
      await repoManager.ensureRepository(
        repoUrl,
        worktreeInfo.originPath,
        branch || "main"
      );

      // Check if the origin directory exists
      try {
        await fs.access(worktreeInfo.originPath);
      } catch {
        console.error(
          "Origin directory does not exist:",
          worktreeInfo.originPath
        );
        socket.emit("list-files-response", {
          files: [],
          error: "Repository directory not found",
        });
        return;
      }

      const ignoredPatterns = [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/coverage/**",
        "**/.turbo/**",
        "**/.vscode/**",
        "**/.idea/**",
        "**/tmp/**",
        "**/.DS_Store",
        "**/npm-debug.log*",
        "**/yarn-debug.log*",
        "**/yarn-error.log*",
      ];

      async function walkDir(
        dir: string,
        baseDir: string
      ): Promise<FileInfo[]> {
        const files: FileInfo[] = [];

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);

            // Check if path should be ignored
            const shouldIgnore = ignoredPatterns.some(
              (pattern) =>
                minimatch(relativePath, pattern) || minimatch(fullPath, pattern)
            );

            if (shouldIgnore) continue;

            // Skip pattern matching here - we'll do fuzzy matching later
            // For directories, we still need to recurse to get all files
            if (entry.isDirectory() && !pattern) {
              // Only add directory if no pattern (for browsing)
              files.push({
                path: fullPath,
                name: entry.name,
                isDirectory: true,
                relativePath,
              });
            }

            if (entry.isDirectory()) {
              // Recurse into subdirectory
              const subFiles = await walkDir(fullPath, baseDir);
              files.push(...subFiles);
            } else {
              files.push({
                path: fullPath,
                name: entry.name,
                isDirectory: false,
                relativePath,
              });
            }
          }
        } catch (error) {
          console.error(`Error reading directory ${dir}:`, error);
        }

        return files;
      }

      // List files from the origin directory
      let fileList = await walkDir(
        worktreeInfo.originPath,
        worktreeInfo.originPath
      );

      // Apply fuzzysort fuzzy matching if pattern is provided
      if (pattern) {
        // Prepare file paths for fuzzysort
        const filePaths = fileList.map((f) => f.relativePath);

        // Use fuzzysort to search and sort files
        const results = fuzzysort.go(pattern, filePaths, {
          threshold: -10000, // Show all results, even poor matches
          limit: 1000, // Limit results for performance
        });

        // Create a map for quick lookup
        const fileMap = new Map(fileList.map((f) => [f.relativePath, f]));

        // Rebuild fileList based on fuzzysort results
        fileList = results
          .map((result) => fileMap.get(result.target)!)
          .filter(Boolean);

        // Add any files that didn't match at the end (if we want to show all files)
        // Uncomment if you want to show non-matching files at the bottom
        // const matchedPaths = new Set(results.map(r => r.target));
        // const unmatchedFiles = fileList.filter(f => !matchedPaths.has(f.relativePath));
        // fileList = [...fileList, ...unmatchedFiles];
      } else {
        // Only sort by directory/name when there's no search query
        fileList.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.relativePath.localeCompare(b.relativePath);
        });
      }

      socket.emit("list-files-response", { files: fileList });
    } catch (error) {
      console.error("Error listing files:", error);
      socket.emit("list-files-response", {
        files: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("github-test-auth", async (callback) => {
    try {
      // Run all commands in parallel
      const [authStatus, whoami, home, ghConfig] = await Promise.all([
        execWithEnv("gh auth status")
          .then((r) => r.stdout)
          .catch((e) => e.message),
        execWithEnv("whoami").then((r) => r.stdout),
        execWithEnv("echo $HOME").then((r) => r.stdout),
        execWithEnv('ls -la ~/.config/gh/ || echo "No gh config"').then(
          (r) => r.stdout
        ),
      ]);

      callback({
        authStatus,
        whoami,
        home,
        ghConfig,
        processEnv: {
          HOME: process.env.HOME,
          USER: process.env.USER,
          GH_TOKEN: process.env.GH_TOKEN ? "Set" : "Not set",
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "Set" : "Not set",
        },
      });
    } catch (error) {
      callback({
        error: error instanceof Error ? error.message : String(error),
        processEnv: {
          HOME: process.env.HOME,
          USER: process.env.USER,
          GH_TOKEN: process.env.GH_TOKEN ? "Set" : "Not set",
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "Set" : "Not set",
        },
      });
    }
  });

  socket.on("github-fetch-repos", async (callback) => {
    try {
      // Check if we already have repos in Convex
      const existingRepos = await convex.query(api.github.getAllRepos, {});
      
      if (existingRepos.length > 0) {
        // Return existing repos from Convex
        const reposByOrg = await convex.query(api.github.getReposByOrg, {});
        callback({ success: true, repos: reposByOrg });
        return;
      }
      
      // If no repos exist, fetch from GitHub
      const [username, userRepos, orgs] = await Promise.all([
        ghApi.getUser(),
        ghApi.getUserRepos(),
        ghApi.getUserOrgs(),
      ]);

      // Fetch repos for all orgs in parallel
      const orgReposPromises = orgs.map(async (org) => ({
        org,
        repos: await ghApi.getOrgRepos(org),
      }));

      const orgReposResults = await Promise.all(orgReposPromises);

      // Combine all repos
      const allRepos: { org: string; repos: string[] }[] = [
        {
          org: username,
          repos: userRepos.filter((repo) => repo.startsWith(`${username}/`)),
        },
        ...orgReposResults,
      ];
      
      // Prepare repos for bulk insert
      const reposToInsert = allRepos.flatMap((orgData) =>
        orgData.repos.map((repo) => ({
          fullName: repo,
          org: orgData.org,
          name: repo.split("/")[1],
          gitRemote: `https://github.com/${repo}.git`,
          provider: "github" as const,
        }))
      );
      
      // Bulk insert repos into Convex
      await convex.mutation(api.github.bulkInsertRepos, {
        repos: reposToInsert,
      });

      // Format repos by organization for response
      const reposByOrg: Record<
        string,
        Array<{ fullName: string; name: string }>
      > = {};

      allRepos.forEach((orgData) => {
        reposByOrg[orgData.org] = orgData.repos.map((repo) => ({
          fullName: repo,
          name: repo.split("/")[1],
        }));
      });

      callback({ success: true, repos: reposByOrg });
    } catch (error) {
      console.error("Error fetching repos:", error);
      callback({
        success: false,
        error: `Failed to fetch GitHub repos: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  socket.on("github-fetch-branches", async (data, callback) => {
    try {
      const { repo } = GitHubFetchBranchesSchema.parse(data);

      // Check if we already have branches for this repo in Convex
      const existingBranches = await convex.query(api.github.getBranches, {
        repo,
      });
      
      if (existingBranches.length > 0) {
        // Return existing branches from Convex
        callback({ success: true, branches: existingBranches });
        return;
      }

      // If no branches exist, fetch from GitHub
      const branches = await ghApi.getRepoBranches(repo);
      
      // Bulk insert branches into Convex
      await convex.mutation(api.github.bulkInsertBranches, {
        repo,
        branches,
      });

      callback({ success: true, branches });
    } catch (error) {
      console.error("Error fetching branches:", error);
      callback({
        success: false,
        error: `Failed to fetch branches: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // No need to kill terminals on disconnect since they're global
  });
});

const PORT = process.env.PORT || 3001;
const server = httpServer.listen(PORT, () => {
  console.log(`Terminal server listening on port ${PORT}`);

  // Start the Docker container state sync
  DockerVSCodeInstance.startContainerStateSync();
});

let isCleaningUp = false;
let isCleanedUp = false;

// Hot reload support
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    if (isCleaningUp || isCleanedUp) {
      console.log("Cleanup already in progress or completed, skipping...");
      return;
    }

    isCleaningUp = true;
    console.log("Cleaning up terminals and server...");

    // Stop Docker container state sync
    DockerVSCodeInstance.stopContainerStateSync();

    // Stop all VSCode instances
    for (const [id, instance] of Array.from(
      VSCodeInstance.getInstances().entries()
    )) {
      console.log(`Stopping VSCode instance ${id}`);
      try {
        await instance.stop();
      } catch (error) {
        console.error(`Error stopping VSCode instance ${id}:`, error);
      }
    }
    VSCodeInstance.clearInstances();

    // Clean up git diff manager
    gitDiffManager.dispose();

    // Close socket.io
    console.log("Closing socket.io server...");
    await new Promise<void>((resolve) => {
      io.close(() => {
        console.log("Socket.io server closed");
        resolve();
      });
    });

    // Close HTTP server only if it's still listening
    console.log("Closing HTTP server...");
    await new Promise<void>((resolve) => {
      if (server.listening) {
        server.close((error) => {
          if (error) {
            console.error("Error closing HTTP server:", error);
          } else {
            console.log("HTTP server closed");
          }
          resolve();
        });
      } else {
        console.log("HTTP server already closed");
        resolve();
      }
    });

    isCleanedUp = true;
    console.log("Cleanup completed");
  });

  import.meta.hot.accept(() => {
    console.log("Hot reload triggered");
  });
}
