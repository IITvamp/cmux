import {
  CloseTerminalSchema,
  CreateTerminalSchema,
  ResizeSchema,
  StartTaskSchema,
  TerminalInputSchema,
  GitFullDiffRequestSchema,
  OpenInEditorSchema,
  ListFilesRequestSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  type FileInfo,
} from "@coderouter/shared";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { spawnAllAgents } from "./agentSpawner.js";
import { createTerminal, type GlobalTerminal } from "./terminal.js";
import { GitDiffManager } from "./gitDiff.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
import { RepositoryManager } from "./repositoryManager.js";
import { getWorktreePath } from "./workspace.js";

const httpServer = createServer();

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

// Global terminal storage - shared across all connections
const globalTerminals = new Map<string, GlobalTerminal>();

// Git diff manager instance
const gitDiffManager = new GitDiffManager();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  globalTerminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });

    // Send properly rendered terminal state
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      // Send terminal restore event with serialized state
      socket.emit("terminal-restore", { terminalId, data: terminalState });
    }
  });

  socket.on("create-terminal", (data) => {
    try {
      const { cols, rows, id } = CreateTerminalSchema.parse(data);
      if (id && globalTerminals.has(id)) {
        console.error(`Terminal ${id} already exists`);
        return;
      }
      const terminalId = id || crypto.randomUUID();

      createTerminal(terminalId, globalTerminals, io, { cols, rows });
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
    }
  });

  socket.on("start-task", async (data, callback) => {
    console.log("skibidi start task");
    try {
      console.log("got data", data);
      const taskData = StartTaskSchema.parse(data);
      console.log("starting task!", taskData);

      // Use the taskId provided by the client
      const taskId = taskData.taskId;

      // Spawn all agents in parallel (each will create its own taskRun)
      const agentResults = await spawnAllAgents(taskId, globalTerminals, io, {
        repoUrl: taskData.repoUrl,
        branch: taskData.branch,
        taskDescription: taskData.taskDescription,
        selectedAgents: taskData.selectedAgents,
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
        } else {
          console.error(`Failed to spawn ${result.agentName}: ${result.error}`);
        }
      });

      // Return the first successful agent's info (you might want to modify this to return all)
      const primaryAgent = successfulAgents[0];
      
      // Set up file watching for git changes
      gitDiffManager.watchWorkspace(primaryAgent.worktreePath, (changedPath) => {
        io.emit("git-file-changed", { 
          workspacePath: primaryAgent.worktreePath,
          filePath: changedPath 
        });
      });
      
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

  socket.on("terminal-input", (inputData) => {
    try {
      const { terminalId, data } = TerminalInputSchema.parse(inputData);
      const terminal = globalTerminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.write(data);
      }
    } catch (error) {
      console.error("Invalid terminal-input data:", error);
    }
  });

  socket.on("resize", (resizeData) => {
    console.log("resize event received", resizeData);
    try {
      const { terminalId, cols, rows } = ResizeSchema.parse(resizeData);
      const terminal = globalTerminals.get(terminalId);

      if (terminal && terminal.pty && !terminal.pty.pid) {
        console.warn(
          `Terminal ${terminalId} has no PID, likely already exited`
        );
        globalTerminals.delete(terminalId);
      } else if (terminal && terminal.pty) {
        // if its the same, dont resize
        // const isSame =
        //   terminal.headlessTerminal.cols === cols &&
        //   terminal.headlessTerminal.rows === rows;
        // if (isSame) {
        //   return;
        // }

        // TODO: this is a hack to get the terminal to resize. If it's the same size, the frontend gets messed up. The code above doesn't work either.
        terminal.pty.resize(cols - 1, rows - 1);
        terminal.headlessTerminal.resize(cols - 1, rows - 1);

        terminal.pty.resize(cols, rows);
        terminal.headlessTerminal.resize(cols, rows);
      }
    } catch (error) {
      console.error("Invalid resize data:", error);
      console.error("here's the invalid resizeData", resizeData);
    }
  });

  socket.on("close-terminal", (closeData) => {
    try {
      const { terminalId } = CloseTerminalSchema.parse(closeData);
      const terminal = globalTerminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.kill();
        globalTerminals.delete(terminalId);

        // Broadcast terminal closure to all clients
        io.emit("terminal-closed", { terminalId });
        console.log(`Global terminal ${terminalId} closed`);
      }
    } catch (error) {
      console.error("Invalid close-terminal data:", error);
    }
  });

  // Keep old handlers for backwards compatibility but they're not used anymore
  socket.on("git-status", async () => {
    socket.emit("git-status-response", { files: [], error: "Not implemented - use git-full-diff instead" });
  });

  socket.on("git-diff", async () => {
    socket.emit("git-diff-response", { 
      path: "",
      diff: [],
      error: "Not implemented - use git-full-diff instead"
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
        error: error instanceof Error ? error.message : "Unknown error"
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
            error: `Failed to open ${editor}: ${error.message}` 
          });
        } else {
          console.log(`Successfully opened ${path} in ${editor}`);
        }
      });
    } catch (error) {
      console.error("Error opening editor:", error);
      socket.emit("open-in-editor-error", { 
        error: error instanceof Error ? error.message : "Unknown error"
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
      await repoManager.ensureRepository(repoUrl, worktreeInfo.originPath, branch || "main");
      
      // Check if the origin directory exists
      try {
        await fs.access(worktreeInfo.originPath);
      } catch {
        console.error("Origin directory does not exist:", worktreeInfo.originPath);
        socket.emit("list-files-response", { 
          files: [],
          error: "Repository directory not found"
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

      async function walkDir(dir: string, baseDir: string): Promise<FileInfo[]> {
        const files: FileInfo[] = [];
        
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);
            
            // Check if path should be ignored
            const shouldIgnore = ignoredPatterns.some(pattern => 
              minimatch(relativePath, pattern) || minimatch(fullPath, pattern)
            );
            
            if (shouldIgnore) continue;
            
            // Check if matches the optional pattern filter
            if (pattern && !minimatch(relativePath, pattern)) {
              // For directories, we still need to recurse in case files inside match
              if (entry.isDirectory()) {
                const subFiles = await walkDir(fullPath, baseDir);
                files.push(...subFiles);
              }
              continue;
            }
            
            if (entry.isDirectory()) {
              files.push({
                path: fullPath,
                name: entry.name,
                isDirectory: true,
                relativePath,
              });
              
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
      const fileList = await walkDir(worktreeInfo.originPath, worktreeInfo.originPath);
      
      // Sort files: directories first, then alphabetically
      fileList.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.relativePath.localeCompare(b.relativePath);
      });
      
      socket.emit("list-files-response", { files: fileList });
    } catch (error) {
      console.error("Error listing files:", error);
      socket.emit("list-files-response", { 
        files: [],
        error: error instanceof Error ? error.message : "Unknown error"
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

    // Kill all running terminals
    globalTerminals.forEach((terminal, id) => {
      console.log(`Killing terminal ${id}`);
      try {
        terminal.pty.kill();
      } catch (error) {
        console.error(`Error killing terminal ${id}:`, error);
      }
    });
    globalTerminals.clear();

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
