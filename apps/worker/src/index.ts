import {
  SERVER_TERMINAL_CONFIG,
  WorkerConfigureGitSchema,
  WorkerCreateTerminalSchema,
  WorkerExecSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type ServerToWorkerEvents,
  type SocketData,
  type WorkerHeartbeat,
  type WorkerRegister,
  type WorkerToServerEvents,
} from "@cmux/shared";
import { SerializeAddon } from "@xterm/addon-serialize";
import * as xtermHeadless from "@xterm/headless";
import express from "express";
import multer from "multer";
import {
  exec,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import { cpus, platform, totalmem } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { Server, type Namespace, type Socket } from "socket.io";
import { checkDockerReadiness } from "./checkDockerReadiness.js";
import { detectTerminalIdle } from "./detectTerminalIdle.js";
import { log } from "./logger.js";

const execAsync = promisify(exec);

const Terminal = xtermHeadless.Terminal;

// Configuration
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const WORKER_PORT = parseInt(process.env.WORKER_PORT || "39377", 10);
const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || "cmux-worker";
const CONTAINER_VERSION = process.env.CONTAINER_VERSION || "0.0.1";

// Create Express app
const app = express();

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  storage: multer.memoryStorage(),
});

// File upload endpoint
app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { path: imagePath } = req.body;
    if (!imagePath) {
      return res.status(400).json({ error: "No path specified" });
    }

    log("INFO", `Received image upload request for path: ${imagePath}`, {
      size: req.file.size,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });

    // Ensure directory exists
    const dir = path.dirname(imagePath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(imagePath, req.file.buffer);

    log("INFO", `Successfully wrote image file: ${imagePath}`);

    // Verify file was created
    const stats = await fs.stat(imagePath);

    res.json({
      success: true,
      path: imagePath,
      size: stats.size,
    });
  } catch (error) {
    log("ERROR", "Failed to upload image", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
});

// Create HTTP server with Express app
const httpServer = createServer(app);

// Socket.IO server with namespaces
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB to handle large images
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
});

// Client namespace
const vscodeIO = io.of("/vscode") as Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Management namespace
const managementIO = io.of("/management") as Namespace<
  ServerToWorkerEvents,
  WorkerToServerEvents
>;

// Track connected main server
let mainServerSocket: Socket<
  ServerToWorkerEvents,
  WorkerToServerEvents
> | null = null;

/**
 * Sanitize a string to be used as a tmux session name.
 * Tmux session names cannot contain: periods (.), colons (:), spaces, or other special characters.
 * We'll replace them with underscores to ensure compatibility.
 */
function sanitizeTmuxSessionName(name: string): string {
  // Replace all invalid characters with underscores
  // Allow only alphanumeric characters, hyphens, and underscores
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Worker statistics
function getWorkerStats(): WorkerHeartbeat {
  const totalMem = totalmem();
  const usedMem = process.memoryUsage().heapUsed;

  return {
    workerId: WORKER_ID,
    timestamp: Date.now(),
    stats: {
      cpuUsage: 0, // TODO: Implement actual CPU usage tracking
      memoryUsage: (usedMem / totalMem) * 100,
    },
  };
}

// Send registration info when main server connects
function registerWithMainServer(
  socket: Socket<ServerToWorkerEvents, WorkerToServerEvents>
) {
  const registration: WorkerRegister = {
    workerId: WORKER_ID,
    capabilities: {
      maxConcurrentTerminals: 50,
      supportedLanguages: ["javascript", "typescript", "python", "go", "rust"],
      gpuAvailable: false,
      memoryMB: Math.floor(totalmem() / 1024 / 1024),
      cpuCores: cpus().length,
    },
    containerInfo: {
      image: CONTAINER_IMAGE,
      version: CONTAINER_VERSION,
      platform: platform(),
    },
  };

  socket.emit("worker:register", registration);
  log(
    "INFO",
    `Worker ${WORKER_ID} sent registration to main server`,
    registration
  );
}

// Management socket server (main server connects to this)
managementIO.on("connection", (socket) => {
  log(
    "INFO",
    `Main server connected to worker ${WORKER_ID}`,
    {
      from: socket.handshake.headers.referer || "unknown",
      socketId: socket.id,
    },
    WORKER_ID
  );
  mainServerSocket = socket;

  // Send registration immediately
  registerWithMainServer(socket);

  // Handle terminal operations from main server
  socket.on("worker:create-terminal", async (data, callback) => {
    log(
      "INFO",
      "Management namespace: Received request to create terminal from main server",
      JSON.stringify(
        data,
        (_key, value) => {
          if (typeof value === "string" && value.length > 1000) {
            return value.slice(0, 1000) + "...";
          }
          return value;
        },
        2
      ),
      WORKER_ID
    );
    try {
      const validated = WorkerCreateTerminalSchema.parse(data);
      log("INFO", "worker:create-terminal validated", validated);

      // Handle auth files first if provided
      if (validated.authFiles && validated.authFiles.length > 0) {
        log(
          "INFO",
          `Writing ${validated.authFiles.length} auth files...`,
          undefined,
          WORKER_ID
        );
        for (const file of validated.authFiles) {
          try {
            // Expand $HOME in destination path
            const destPath = file.destinationPath.replace(
              "$HOME",
              process.env.HOME || "/root"
            );
            log(
              "INFO",
              `Writing auth file to: ${destPath}`,
              undefined,
              WORKER_ID
            );

            // Ensure directory exists
            const dir = path.dirname(destPath);
            await fs.mkdir(dir, { recursive: true });

            // Write the file
            await fs.writeFile(
              destPath,
              Buffer.from(file.contentBase64, "base64")
            );

            // Set permissions if specified
            if (file.mode) {
              await fs.chmod(destPath, parseInt(file.mode, 8));
            }

            log(
              "INFO",
              `Successfully wrote auth file: ${destPath}`,
              undefined,
              WORKER_ID
            );
          } catch (error) {
            log(
              "ERROR",
              `Failed to write auth file ${file.destinationPath}:`,
              error,
              WORKER_ID
            );
          }
        }
      }

      // Execute startup commands if provided
      if (validated.startupCommands && validated.startupCommands.length > 0) {
        log(
          "INFO",
          `Executing ${validated.startupCommands.length} startup commands...`,
          undefined,
          WORKER_ID
        );

        for (const command of validated.startupCommands) {
          try {
            log(
              "INFO",
              `Executing startup command: ${command}`,
              undefined,
              WORKER_ID
            );
            const { stdout, stderr } = await execAsync(command, {
              env: { ...process.env, ...validated.env },
            });
            if (stdout) {
              log(
                "INFO",
                `Startup command stdout: ${stdout}`,
                undefined,
                WORKER_ID
              );
            }
            if (stderr) {
              log(
                "INFO",
                `Startup command stderr: ${stderr}`,
                undefined,
                WORKER_ID
              );
            }
            log(
              "INFO",
              `Successfully executed startup command`,
              undefined,
              WORKER_ID
            );
          } catch (error) {
            log(
              "ERROR",
              `Failed to execute startup command: ${command}`,
              error,
              WORKER_ID
            );
          }
        }
      }

      log(
        "INFO",
        "Creating terminal with options",
        {
          terminalId: validated.terminalId,
          cols: validated.cols,
          rows: validated.rows,
          cwd: validated.cwd,
          env: Object.keys(validated.env || {}),
          // env: validated.env,
          command: validated.command,
          args: validated.args,
          taskId: validated.taskId,
        },
        WORKER_ID
      );

      await createTerminal(validated.terminalId, {
        cols: validated.cols,
        rows: validated.rows,
        cwd: validated.cwd,
        env: validated.env,
        command: validated.command,
        args: validated.args,
        taskId: validated.taskId,
        startupCommands: validated.startupCommands,
      });

      callback({
        error: null,
        data: {
          workerId: WORKER_ID,
          terminalId: validated.terminalId,
        },
      });
      socket.emit("worker:terminal-created", {
        workerId: WORKER_ID,
        terminalId: validated.terminalId,
      });
    } catch (error) {
      log(
        "ERROR",
        "Error creating terminal from main server",
        error,
        WORKER_ID
      );
      callback({
        error: error instanceof Error ? error : new Error(error as string),
        data: null,
      });
      socket.emit("worker:error", {
        workerId: WORKER_ID,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("worker:check-docker", async (callback) => {
    console.log(`Worker ${WORKER_ID} checking Docker readiness`);

    try {
      // Check if Docker socket is accessible
      const dockerReady = await checkDockerReadiness();

      callback({
        ready: dockerReady,
        message: dockerReady ? "Docker is ready" : "Docker is not ready",
      });
    } catch (error) {
      callback({
        ready: false,
        message: `Error checking Docker: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  });

  socket.on("worker:configure-git", async (data) => {
    try {
      const validated = WorkerConfigureGitSchema.parse(data);
      console.log(`Worker ${WORKER_ID} configuring git...`);

      // Create a custom git config file that includes the mounted one
      const customGitConfigPath = "/root/.gitconfig.custom";

      // Parse existing config into sections
      const configSections: Map<string, Map<string, string>> = new Map();

      // Start by parsing the mounted config if it exists
      try {
        const { stdout: mountedConfig } = await execAsync(
          "cat /root/.gitconfig 2>/dev/null || true"
        );
        if (mountedConfig) {
          let currentSection = "global";
          const lines = mountedConfig.split("\n");

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith("#")) continue;

            // Check for section header
            const sectionMatch = trimmedLine.match(/^\[(.+)\]$/);
            if (sectionMatch) {
              currentSection = sectionMatch[1] || "global";
              if (!configSections.has(currentSection)) {
                configSections.set(currentSection, new Map());
              }
              continue;
            }

            // Parse key-value pairs
            const keyValueMatch = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
            if (keyValueMatch) {
              const [, key, value] = keyValueMatch;
              if (key && value) {
                if (!configSections.has(currentSection)) {
                  configSections.set(currentSection, new Map());
                }
                configSections.get(currentSection)!.set(key, value);
              }
            }
          }
        }
      } catch {
        // No mounted config
      }

      // Add the store credential helper
      if (!configSections.has("credential")) {
        configSections.set("credential", new Map());
      }
      configSections.get("credential")!.set("helper", "store");

      // Create .git-credentials file if GitHub token is provided
      if (validated.githubToken) {
        const credentialsPath = "/root/.git-credentials";
        const credentialsContent = `https://oauth:${validated.githubToken}@github.com\n`;
        await fs.writeFile(credentialsPath, credentialsContent);
        await fs.chmod(credentialsPath, 0o600);
        console.log("GitHub credentials stored in .git-credentials");
      }

      // Add additional git settings if provided
      if (validated.gitConfig) {
        for (const [key, value] of Object.entries(validated.gitConfig)) {
          const [section, ...keyParts] = key.split(".");
          const configKey = keyParts.join(".");

          if (section && configKey) {
            if (!configSections.has(section)) {
              configSections.set(section, new Map());
            }
            configSections.get(section)!.set(configKey, value);
          }
        }
      }

      // Build the final config content
      let gitConfigContent = "";
      for (const [section, settings] of configSections) {
        if (section !== "global") {
          gitConfigContent += `[${section}]\n`;
          for (const [key, value] of settings) {
            gitConfigContent += `\t${key} = ${value}\n`;
          }
          gitConfigContent += "\n";
        }
      }

      // Write the custom config
      await fs.writeFile(customGitConfigPath, gitConfigContent);

      // Set GIT_CONFIG environment variable to use our custom config
      process.env.GIT_CONFIG_GLOBAL = customGitConfigPath;

      // Also set it for all terminals
      await execAsync(
        `echo 'export GIT_CONFIG_GLOBAL=${customGitConfigPath}' >> /etc/profile`
      );
      await execAsync(
        `echo 'export GIT_CONFIG_GLOBAL=${customGitConfigPath}' >> /root/.bashrc`
      );

      // Set up SSH keys if provided
      if (validated.sshKeys) {
        // Check if .ssh is mounted (read-only)
        const sshDir = "/root/.ssh";
        let sshDirWritable = true;

        try {
          // Try to create a test file
          await fs.writeFile(path.join(sshDir, ".test"), "test");
          // If successful, remove it
          await execAsync(`rm -f ${path.join(sshDir, ".test")}`);
        } catch {
          // SSH dir is read-only, use alternative location
          sshDirWritable = false;
          console.log(
            ".ssh directory is mounted read-only, using alternative SSH config"
          );
        }

        if (!sshDirWritable) {
          // Use alternative SSH directory
          const altSshDir = "/root/.ssh-custom";
          await fs.mkdir(altSshDir, { recursive: true });

          if (validated.sshKeys.privateKey) {
            const privateKeyPath = path.join(altSshDir, "id_rsa");
            await fs.writeFile(
              privateKeyPath,
              Buffer.from(validated.sshKeys.privateKey, "base64")
            );
            await fs.chmod(privateKeyPath, 0o600);
          }

          if (validated.sshKeys.publicKey) {
            const publicKeyPath = path.join(altSshDir, "id_rsa.pub");
            await fs.writeFile(
              publicKeyPath,
              Buffer.from(validated.sshKeys.publicKey, "base64")
            );
            await fs.chmod(publicKeyPath, 0o644);
          }

          if (validated.sshKeys.knownHosts) {
            const knownHostsPath = path.join(altSshDir, "known_hosts");
            await fs.writeFile(
              knownHostsPath,
              Buffer.from(validated.sshKeys.knownHosts, "base64")
            );
            await fs.chmod(knownHostsPath, 0o644);
          }

          // Create SSH config to use our custom directory
          const sshConfigContent = `Host *
  IdentityFile ${altSshDir}/id_rsa
  UserKnownHostsFile ${altSshDir}/known_hosts
  StrictHostKeyChecking accept-new
`;
          await fs.writeFile("/root/.ssh-config", sshConfigContent);

          // Set GIT_SSH_COMMAND to use our custom config
          process.env.GIT_SSH_COMMAND = "ssh -F /root/.ssh-config";

          // Also export it for all terminals
          await execAsync(
            `echo 'export GIT_SSH_COMMAND="ssh -F /root/.ssh-config"' >> /etc/profile`
          );
          await execAsync(
            `echo 'export GIT_SSH_COMMAND="ssh -F /root/.ssh-config"' >> /root/.bashrc`
          );
        } else {
          // SSH dir is writable, use it normally
          if (validated.sshKeys.privateKey) {
            const privateKeyPath = path.join(sshDir, "id_rsa");
            await fs.writeFile(
              privateKeyPath,
              Buffer.from(validated.sshKeys.privateKey, "base64")
            );
            await fs.chmod(privateKeyPath, 0o600);
          }

          if (validated.sshKeys.publicKey) {
            const publicKeyPath = path.join(sshDir, "id_rsa.pub");
            await fs.writeFile(
              publicKeyPath,
              Buffer.from(validated.sshKeys.publicKey, "base64")
            );
            await fs.chmod(publicKeyPath, 0o644);
          }

          if (validated.sshKeys.knownHosts) {
            const knownHostsPath = path.join(sshDir, "known_hosts");
            await fs.writeFile(
              knownHostsPath,
              Buffer.from(validated.sshKeys.knownHosts, "base64")
            );
            await fs.chmod(knownHostsPath, 0o644);
          }
        }
      }

      console.log(`Worker ${WORKER_ID} git configuration complete`);
    } catch (error) {
      console.error("Error configuring git:", error);
      socket.emit("worker:error", {
        workerId: WORKER_ID,
        error:
          error instanceof Error ? error.message : "Failed to configure git",
      });
    }
  });

  socket.on("worker:exec", async (data, callback) => {
    try {
      const validated = WorkerExecSchema.parse(data);
      log("INFO", `Worker ${WORKER_ID} executing command:`, {
        command: validated.command,
        args: validated.args,
        cwd: validated.cwd,
      });

      const commandWithArgs = validated.args
        ? `${validated.command} ${validated.args.join(" ")}`
        : validated.command;

      const execOptions = {
        cwd: validated.cwd || process.env.HOME || "/",
        env: { ...process.env, ...validated.env },
        timeout: validated.timeout,
      };

      try {
        const { stdout, stderr } = await execAsync(
          commandWithArgs,
          execOptions
        );

        log("INFO", `Command executed successfully: ${validated.command}`, {
          stdout: stdout?.slice(0, 200),
          stderr: stderr?.slice(0, 200),
        });

        callback({
          error: null,
          data: {
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: 0,
          },
        });
      } catch (execError: any) {
        // exec throws when exit code is non-zero
        log("WARN", `Command failed with non-zero exit: ${validated.command}`, {
          exitCode: execError.code,
          stdout: execError.stdout?.slice(0, 200),
          stderr: execError.stderr?.slice(0, 200),
        });

        callback({
          error: null,
          data: {
            stdout: execError.stdout || "",
            stderr: execError.stderr || "",
            exitCode: execError.code || 1,
            signal: execError.signal,
          },
        });
      }
    } catch (error) {
      log("ERROR", "Error executing command", error, WORKER_ID);
      callback({
        error: error instanceof Error ? error : new Error(String(error)),
        data: null,
      });
    }
  });

  socket.on("worker:shutdown", () => {
    console.log(`Worker ${WORKER_ID} received shutdown command`);
    gracefulShutdown();
  });

  socket.on("disconnect", () => {
    console.log(`Main server disconnected from worker ${WORKER_ID}`);
    mainServerSocket = null;
  });
});

// Client socket server
vscodeIO.on("connection", (socket) => {
  console.log(
    `VSCode connected to worker ${WORKER_ID}:`,
    socket.id,
    "from",
    socket.handshake.headers.referer || "unknown"
  );

  socket.on("disconnect", () => {
    console.log(`Client disconnected from worker ${WORKER_ID}:`, socket.id);
  });
});

// Create terminal helper function
async function createTerminal(
  terminalId: string,
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    command?: string;
    args?: string[];
    taskId?: string;
    startupCommands?: string[];
  } = {}
): Promise<void> {
  const {
    cols = SERVER_TERMINAL_CONFIG.cols,
    rows = SERVER_TERMINAL_CONFIG.rows,
    cwd = process.env.HOME || "/",
    env = {},
    command,
    args = [],
  } = options;

  const shell = command || (platform() === "win32" ? "powershell.exe" : "bash");

  log("INFO", `[createTerminal] Creating terminal ${terminalId}:`, {
    cols,
    rows,
    cwd,
    command,
    args,
    envKeys: Object.keys(env),
    shell,
  });

  // Prepare the spawn command and args
  let spawnCommand: string;
  let spawnArgs: string[];

  if (command === "tmux") {
    // Direct tmux command from agent spawner
    spawnCommand = command;
    spawnArgs = args;
    log("INFO", `[createTerminal] Using direct tmux command:`, {
      spawnCommand,
      spawnArgs,
    });
  } else {
    // Create tmux session with command
    spawnCommand = "tmux";
    spawnArgs = ["new-session", "-A", "-s", sanitizeTmuxSessionName(terminalId)];
    spawnArgs.push("-x", cols.toString(), "-y", rows.toString());

    if (command) {
      spawnArgs.push(command);
      if (args.length > 0) {
        spawnArgs.push(...args);
      }
    } else {
      spawnArgs.push(shell);
    }
    log("INFO", `[createTerminal] Creating tmux session:`, {
      spawnCommand,
      spawnArgs,
    });
  }

  const ptyEnv = {
    ...process.env,
    ...env, // Override with provided env vars
    WORKER_ID,
    TERM: "xterm-256color",
    PS1: "\\u@\\h:\\w\\$ ", // Basic prompt
    SHELL: "/bin/bash",
    USER: process.env.USER || "root",
    HOME: process.env.HOME || "/root",
    PATH: `/root/.bun/bin:${
      process.env.PATH ||
      "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    }`,
    // Pass through git config if set
    ...(process.env.GIT_CONFIG_GLOBAL
      ? { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL }
      : {}),
    ...(process.env.GIT_SSH_COMMAND
      ? { GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND }
      : {}),
  };

  log("INFO", "Spawning process", {
    command: spawnCommand,
    args: spawnArgs,
    cwd,
    envKeys: Object.keys(ptyEnv),
  });

  let childProcess: ChildProcessWithoutNullStreams;
  const processStartTime = Date.now();

  try {
    // Add LINES and COLUMNS to environment for terminal size
    const processEnv = {
      ...ptyEnv,
      LINES: rows.toString(),
      COLUMNS: cols.toString(),
    };

    childProcess = spawn(spawnCommand, spawnArgs, {
      cwd,
      env: processEnv,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    log("INFO", "Process spawned successfully", {
      pid: childProcess.pid,
      terminalId,
    });
  } catch (error) {
    log("ERROR", "Failed to spawn process", error);
    return;
  }

  const headlessTerminal = new Terminal({
    cols,
    rows,
    scrollback: SERVER_TERMINAL_CONFIG.scrollback,
    allowProposedApi: SERVER_TERMINAL_CONFIG.allowProposedApi,
  });

  const serializeAddon = new SerializeAddon();
  headlessTerminal.loadAddon(serializeAddon);

  // Increment active terminal count
  log("INFO", "Terminal created", {
    terminalId,
  });

  // Pipe data from child process to headless terminal
  childProcess.stdout.on("data", (data: Buffer) => {
    headlessTerminal.write(data.toString());
  });

  childProcess.stderr.on("data", (data: Buffer) => {
    headlessTerminal.write(data.toString());
  });

  // Handle data from terminal (user input) to child process
  headlessTerminal.onData((data: string) => {
    if (childProcess.stdin.writable) {
      childProcess.stdin.write(data);
    }
  });

  // Handle process exit
  childProcess.on("exit", (code, signal) => {
    log("INFO", `Process exited for terminal ${terminalId}`, { code, signal });

    // Notify via management socket if connected
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-exit", {
        workerId: WORKER_ID,
        terminalId,
        exitCode: code ?? 0,
      });
    }
  });

  childProcess.on("error", (error) => {
    log("ERROR", `Process error for terminal ${terminalId}`, error);

    if (mainServerSocket) {
      mainServerSocket.emit("worker:error", {
        workerId: WORKER_ID,
        error: `Terminal ${terminalId} process error: ${error.message}`,
      });
    }
  });

  log("INFO", "command=", command);
  log("INFO", "args=", args);

  // detect idle
  if (command === "tmux" && args.length > 0) {
    // Extract session name from tmux args
    const sessionIndex = args.indexOf("-s");
    const sessionName =
      sessionIndex !== -1 && args[sessionIndex + 1]
        ? args[sessionIndex + 1]
        : terminalId;

    log("INFO", "Setting up idle detection for terminal", {
      terminalId,
      sessionName,
    });

    detectTerminalIdle({
      sessionName: sessionName || terminalId,
      idleTimeoutMs: 5000, // 5 seconds for production
      onIdle: () => {
        log("INFO", "Terminal idle detected", {
          terminalId,
          taskId: options.taskId,
        });

        const elapsedMs = Date.now() - processStartTime;
        // Emit idle event via management socket
        if (mainServerSocket && options.taskId) {
          mainServerSocket.emit("worker:terminal-idle", {
            workerId: WORKER_ID,
            terminalId,
            taskId: options.taskId,
            elapsedMs,
          });
        }
      },
    })
      .then(async ({ elapsedMs }) => {
        log("INFO", `Terminal ${terminalId} idle after ${elapsedMs}ms`, {
          terminalId,
          taskId: options.taskId,
        });
      })
      .catch((error) => {
        log("ERROR", `Failed to detect idle for terminal ${terminalId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  log("INFO", "Terminal creation complete", { terminalId });
}

const ENABLE_HEARTBEAT = false;
if (ENABLE_HEARTBEAT) {
  // Heartbeat interval (send stats every 30 seconds)
  setInterval(() => {
    const stats = getWorkerStats();

    if (mainServerSocket) {
      mainServerSocket.emit("worker:heartbeat", stats);
    } else {
      console.log(
        `Worker ${WORKER_ID} heartbeat (main server not connected):`,
        stats
      );
    }
  }, 30000);
}

// Start server
httpServer.listen(WORKER_PORT, () => {
  log(
    "INFO",
    `Worker ${WORKER_ID} starting on port ${WORKER_PORT}`,
    undefined,
    WORKER_ID
  );
  log(
    "INFO",
    "Namespaces:",
    {
      vscode: "/vscode",
      management: "/management",
    },
    WORKER_ID
  );
  log(
    "INFO",
    "Worker ready, waiting for terminal creation commands via socket.io",
    undefined,
    WORKER_ID
  );
});

// Graceful shutdown
function gracefulShutdown() {
  console.log(`Worker ${WORKER_ID} shutting down...`);

  // Close server
  io.close(() => {
    console.log("Socket.IO server closed");
  });

  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
