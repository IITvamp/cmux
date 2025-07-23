import {
  CloseTerminalSchema,
  CreateTerminalSchema,
  ResizeSchema,
  TerminalInputSchema,
  WorkerCloseTerminalSchema,
  WorkerCreateTerminalSchema,
  WorkerResizeTerminalSchema,
  WorkerTerminalInputSchema,
  WorkerConfigureGitSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type ServerToWorkerEvents,
  type SocketData,
  type WorkerHeartbeat,
  type WorkerRegister,
  type WorkerToServerEvents,
  SERVER_TERMINAL_CONFIG,
} from "@coderouter/shared";
import { SerializeAddon } from "@xterm/addon-serialize";
import * as xtermHeadless from "@xterm/headless";
import { spawn, type IPty } from "node-pty";
import { promises as fs, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { createServer } from "node:http";
import { cpus, platform, totalmem } from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { Server, type Namespace, type Socket } from "socket.io";
import { Agent, fetch } from "undici";
import { log } from "./logger.js";

const Terminal = xtermHeadless.Terminal;

interface WorkerTerminal {
  pty: IPty;
  headlessTerminal: xtermHeadless.Terminal;
  serializeAddon: SerializeAddon;
  taskId?: string;
}

// Configuration
const WORKER_ID = process.env.WORKER_ID || `worker-${Date.now()}`;
const WORKER_PORT = parseInt(process.env.WORKER_PORT || "39377", 10);
const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || "coderouter-worker";
const CONTAINER_VERSION = process.env.CONTAINER_VERSION || "0.0.1";

// Check Docker readiness using undici with retries
async function checkDockerReadiness(): Promise<boolean> {
  const agent = new Agent({
    connect: {
      socketPath: "/var/run/docker.sock",
    },
  });

  const maxRetries = 100; // 10 seconds / 0.1 seconds
  const retryDelay = 100; // 100ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("http://localhost/_ping", {
        dispatcher: agent,
        signal: AbortSignal.timeout(1000), // 1 second timeout per attempt
      });

      if (response.ok) {
        agent.close();
        return true;
      }
    } catch (_error) {
      // Ignore errors and retry
    }

    // Wait before retrying (except on last attempt)
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  agent.close();
  return false;
}

// Terminal storage
const terminals = new Map<string, WorkerTerminal>();

// Create HTTP server
const httpServer = createServer();

// Socket.IO server with namespaces
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB to handle large auth files
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

// Worker statistics
function getWorkerStats(): WorkerHeartbeat {
  const totalMem = totalmem();
  const usedMem = process.memoryUsage().heapUsed;

  return {
    workerId: WORKER_ID,
    timestamp: Date.now(),
    stats: {
      activeTerminals: terminals.size,
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
      // data,
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
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);

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

      const terminal = await createTerminal(validated.terminalId, {
        cols: validated.cols,
        rows: validated.rows,
        cwd: validated.cwd,
        env: validated.env,
        command: validated.command,
        args: validated.args,
        taskId: validated.taskId,
        startupCommands: validated.startupCommands,
      });

      if (!terminal) {
        throw new Error("Failed to create terminal");
      }

      terminals.set(validated.terminalId, terminal);

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

  socket.on("worker:terminal-input", (data) => {
    try {
      const validated = WorkerTerminalInputSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.write(validated.data);
      }
    } catch (error) {
      console.error("Error handling terminal input from main server:", error);
    }
  });

  socket.on("worker:resize-terminal", (data) => {
    try {
      const validated = WorkerResizeTerminalSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.resize(validated.cols, validated.rows);
        terminal.headlessTerminal.resize(validated.cols, validated.rows);
      }
    } catch (error) {
      console.error("Error resizing terminal from main server:", error);
    }
  });

  socket.on("worker:close-terminal", (data) => {
    try {
      const validated = WorkerCloseTerminalSchema.parse(data);
      const terminal = terminals.get(validated.terminalId);
      if (terminal && terminal.pty) {
        terminal.pty.kill();
        terminals.delete(validated.terminalId);
        vscodeIO.emit("terminal-closed", { terminalId: validated.terminalId });

        socket.emit("worker:terminal-closed", {
          workerId: WORKER_ID,
          terminalId: validated.terminalId,
        });
      }
    } catch (error) {
      console.error("Error closing terminal from main server:", error);
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
        message: `Error checking Docker: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  });

  socket.on("worker:configure-git", (data) => {
    try {
      const validated = WorkerConfigureGitSchema.parse(data);
      console.log(`Worker ${WORKER_ID} configuring git...`);

      // Create a custom git config file that includes the mounted one
      const customGitConfigPath = '/root/.gitconfig.custom';
      
      // Parse existing config into sections
      const configSections: Map<string, Map<string, string>> = new Map();
      
      // Start by parsing the mounted config if it exists
      try {
        const mountedConfig = execSync('cat /root/.gitconfig 2>/dev/null || true').toString();
        if (mountedConfig) {
          let currentSection = 'global';
          const lines = mountedConfig.split('\n');
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;
            
            // Check for section header
            const sectionMatch = trimmedLine.match(/^\[(.+)\]$/);
            if (sectionMatch) {
              currentSection = sectionMatch[1] || 'global';
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
      if (!configSections.has('credential')) {
        configSections.set('credential', new Map());
      }
      configSections.get('credential')!.set('helper', 'store');
      
      // Create .git-credentials file if GitHub token is provided
      if (validated.githubToken) {
        const credentialsPath = '/root/.git-credentials';
        const credentialsContent = `https://oauth:${validated.githubToken}@github.com\n`;
        writeFileSync(credentialsPath, credentialsContent);
        chmodSync(credentialsPath, 0o600);
        console.log("GitHub credentials stored in .git-credentials");
      }

      // Add additional git settings if provided
      if (validated.gitConfig) {
        for (const [key, value] of Object.entries(validated.gitConfig)) {
          const [section, ...keyParts] = key.split('.');
          const configKey = keyParts.join('.');
          
          if (section && configKey) {
            if (!configSections.has(section)) {
              configSections.set(section, new Map());
            }
            configSections.get(section)!.set(configKey, value);
          }
        }
      }

      // Build the final config content
      let gitConfigContent = '';
      for (const [section, settings] of configSections) {
        if (section !== 'global') {
          gitConfigContent += `[${section}]\n`;
          for (const [key, value] of settings) {
            gitConfigContent += `\t${key} = ${value}\n`;
          }
          gitConfigContent += '\n';
        }
      }

      // Write the custom config
      writeFileSync(customGitConfigPath, gitConfigContent);
      
      // Set GIT_CONFIG environment variable to use our custom config
      process.env.GIT_CONFIG_GLOBAL = customGitConfigPath;
      
      // Also set it for all terminals
      execSync(`echo 'export GIT_CONFIG_GLOBAL=${customGitConfigPath}' >> /etc/profile`);
      execSync(`echo 'export GIT_CONFIG_GLOBAL=${customGitConfigPath}' >> /root/.bashrc`);

      // Set up SSH keys if provided
      if (validated.sshKeys) {
        // Check if .ssh is mounted (read-only)
        const sshDir = '/root/.ssh';
        let sshDirWritable = true;
        
        try {
          // Try to create a test file
          writeFileSync(path.join(sshDir, '.test'), 'test');
          // If successful, remove it
          execSync(`rm -f ${path.join(sshDir, '.test')}`);
        } catch {
          // SSH dir is read-only, use alternative location
          sshDirWritable = false;
          console.log('.ssh directory is mounted read-only, using alternative SSH config');
        }

        if (!sshDirWritable) {
          // Use alternative SSH directory
          const altSshDir = '/root/.ssh-custom';
          mkdirSync(altSshDir, { recursive: true });

          if (validated.sshKeys.privateKey) {
            const privateKeyPath = path.join(altSshDir, 'id_rsa');
            writeFileSync(privateKeyPath, Buffer.from(validated.sshKeys.privateKey, 'base64'));
            chmodSync(privateKeyPath, 0o600);
          }

          if (validated.sshKeys.publicKey) {
            const publicKeyPath = path.join(altSshDir, 'id_rsa.pub');
            writeFileSync(publicKeyPath, Buffer.from(validated.sshKeys.publicKey, 'base64'));
            chmodSync(publicKeyPath, 0o644);
          }

          if (validated.sshKeys.knownHosts) {
            const knownHostsPath = path.join(altSshDir, 'known_hosts');
            writeFileSync(knownHostsPath, Buffer.from(validated.sshKeys.knownHosts, 'base64'));
            chmodSync(knownHostsPath, 0o644);
          }

          // Create SSH config to use our custom directory
          const sshConfigContent = `Host *
  IdentityFile ${altSshDir}/id_rsa
  UserKnownHostsFile ${altSshDir}/known_hosts
  StrictHostKeyChecking accept-new
`;
          writeFileSync('/root/.ssh-config', sshConfigContent);
          
          // Set GIT_SSH_COMMAND to use our custom config
          process.env.GIT_SSH_COMMAND = 'ssh -F /root/.ssh-config';
          
          // Also export it for all terminals
          execSync(`echo 'export GIT_SSH_COMMAND="ssh -F /root/.ssh-config"' >> /etc/profile`);
          execSync(`echo 'export GIT_SSH_COMMAND="ssh -F /root/.ssh-config"' >> /root/.bashrc`);
        } else {
          // SSH dir is writable, use it normally
          if (validated.sshKeys.privateKey) {
            const privateKeyPath = path.join(sshDir, 'id_rsa');
            writeFileSync(privateKeyPath, Buffer.from(validated.sshKeys.privateKey, 'base64'));
            chmodSync(privateKeyPath, 0o600);
          }

          if (validated.sshKeys.publicKey) {
            const publicKeyPath = path.join(sshDir, 'id_rsa.pub');
            writeFileSync(publicKeyPath, Buffer.from(validated.sshKeys.publicKey, 'base64'));
            chmodSync(publicKeyPath, 0o644);
          }

          if (validated.sshKeys.knownHosts) {
            const knownHostsPath = path.join(sshDir, 'known_hosts');
            writeFileSync(knownHostsPath, Buffer.from(validated.sshKeys.knownHosts, 'base64'));
            chmodSync(knownHostsPath, 0o644);
          }
        }
      }

      console.log(`Worker ${WORKER_ID} git configuration complete`);
    } catch (error) {
      console.error("Error configuring git:", error);
      socket.emit("worker:error", {
        workerId: WORKER_ID,
        error: error instanceof Error ? error.message : "Failed to configure git",
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
    `Client connected to worker ${WORKER_ID}:`,
    socket.id,
    "from",
    socket.handshake.headers.referer || "unknown"
  );

  // Send existing terminals to new connections
  terminals.forEach((terminal, terminalId) => {
    socket.emit("terminal-created", { terminalId });

    // Send terminal state
    const terminalState = terminal.serializeAddon.serialize();
    if (terminalState) {
      socket.emit("terminal-restore", { terminalId, data: terminalState });
    }
  });

  socket.on("create-terminal", async (data) => {
    console.log(
      `Client namespace: Received request to create terminal from client ${socket.id}`,
      data
    );
    try {
      const { cols, rows, id } = CreateTerminalSchema.parse(data);

      if (id && terminals.has(id)) {
        console.error(`Terminal ${id} already exists`);
        return;
      }

      const terminalId = id || crypto.randomUUID();
      const terminal = await createTerminal(terminalId, { cols, rows });

      if (terminal) {
        vscodeIO.emit("terminal-created", { terminalId });
        console.log(`Terminal ${terminalId} created on worker ${WORKER_ID}`);

        // Notify main server if connected
        if (mainServerSocket) {
          mainServerSocket.emit("worker:terminal-created", {
            workerId: WORKER_ID,
            terminalId,
          });
        }
      }
    } catch (error) {
      console.error("Invalid create-terminal data:", error);
    }
  });

  socket.on("terminal-input", (inputData) => {
    try {
      const { terminalId, data } = TerminalInputSchema.parse(inputData);
      const terminal = terminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.write(data);
      }
    } catch (error) {
      console.error("Invalid terminal-input data:", error);
    }
  });

  socket.on("resize", (resizeData) => {
    try {
      const { terminalId, cols, rows } = ResizeSchema.parse(resizeData);
      const terminal = terminals.get(terminalId);

      if (terminal && terminal.pty) {
        if (!terminal.pty.pid) {
          console.warn(
            `Terminal ${terminalId} has no PID, likely already exited`
          );
          terminals.delete(terminalId);
        } else {
          // Resize hack similar to main server
          terminal.pty.resize(cols - 1, rows - 1);
          terminal.headlessTerminal.resize(cols - 1, rows - 1);
          terminal.pty.resize(cols, rows);
          terminal.headlessTerminal.resize(cols, rows);
        }
      }
    } catch (error) {
      console.error("Invalid resize data:", error);
    }
  });

  socket.on("close-terminal", (closeData) => {
    try {
      const { terminalId } = CloseTerminalSchema.parse(closeData);
      const terminal = terminals.get(terminalId);

      if (terminal && terminal.pty) {
        terminal.pty.kill();
        terminals.delete(terminalId);
        vscodeIO.emit("terminal-closed", { terminalId });
        console.log(`Terminal ${terminalId} closed on worker ${WORKER_ID}`);

        // Notify main server if connected
        if (mainServerSocket) {
          mainServerSocket.emit("worker:terminal-closed", {
            workerId: WORKER_ID,
            terminalId,
          });
        }
      }
    } catch (error) {
      console.error("Invalid close-terminal data:", error);
    }
  });

  socket.on("get-active-terminals", () => {
    const activeTerminals = Array.from(terminals.entries()).map(
      ([id, terminal]) => ({
        terminalId: id,
        taskId: terminal.taskId,
      })
    );
    socket.emit("active-terminals", activeTerminals);
  });

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
): Promise<WorkerTerminal | null> {
  if (terminals.has(terminalId)) {
    log("ERROR", `Terminal ${terminalId} already exists`);
    return null;
  }

  const {
    cols = SERVER_TERMINAL_CONFIG.cols,
    rows = SERVER_TERMINAL_CONFIG.rows,
    cwd = process.env.HOME || "/",
    env = {},
    command,
    args = [],
    taskId,
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
    spawnArgs = ["new-session", "-A", "-s", terminalId];
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
    PATH: `/root/.bun/bin:${process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}`,
    // Pass through git config if set
    ...(process.env.GIT_CONFIG_GLOBAL ? { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL } : {}),
    ...(process.env.GIT_SSH_COMMAND ? { GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND } : {}),
  };

  log("INFO", "Spawning PTY process", {
    command: spawnCommand,
    args: spawnArgs,
    cwd,
    envKeys: Object.keys(ptyEnv),
  });

  let ptyProcess: IPty;
  try {
    ptyProcess = spawn(spawnCommand, spawnArgs, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: ptyEnv,
    });

    log("INFO", "PTY process spawned successfully", {
      pid: ptyProcess.pid,
      terminalId,
    });
  } catch (error) {
    log("ERROR", "Failed to spawn PTY process", error);
    return null;
  }

  const headlessTerminal = new Terminal({
    cols,
    rows,
    scrollback: SERVER_TERMINAL_CONFIG.scrollback,
    allowProposedApi: SERVER_TERMINAL_CONFIG.allowProposedApi,
  });

  const serializeAddon = new SerializeAddon();
  headlessTerminal.loadAddon(serializeAddon);

  const terminal: WorkerTerminal = {
    pty: ptyProcess,
    headlessTerminal,
    serializeAddon,
    taskId,
  };

  terminals.set(terminalId, terminal);
  log("INFO", "Terminal added to registry", {
    terminalId,
    totalTerminals: terminals.size,
  });

  // Handle PTY data
  ptyProcess.onData((data) => {
    headlessTerminal.write(data);
    vscodeIO.emit("terminal-output", { terminalId, data });

    // Also send to main server if connected
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-output", {
        workerId: WORKER_ID,
        terminalId,
        data,
      });
    }
  });

  // Handle PTY exit
  ptyProcess.onExit(async ({ exitCode, signal }) => {
    log("INFO", `Terminal ${terminalId} exited`, { exitCode, signal });

    // Save the full state
    const serializedState = serializeAddon.serialize();
    const stateFile = `/var/log/cmux/terminal-state-${terminalId}.log`;

    try {
      await fs.writeFile(stateFile, serializedState);
      log("INFO", `Full state saved to ${stateFile}`);
    } catch (error) {
      log("ERROR", `Failed to save terminal state`, error);
    }

    terminals.delete(terminalId);
    vscodeIO.emit("terminal-exit", { terminalId, exitCode, signal });

    // Notify main server if connected
    if (mainServerSocket) {
      mainServerSocket.emit("worker:terminal-exit", {
        workerId: WORKER_ID,
        terminalId,
        exitCode,
        signal,
      });
    }
  });

  log("INFO", "Terminal creation complete", { terminalId });
  return terminal;
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

  // Kill all terminals
  terminals.forEach((terminal, id) => {
    console.log(`Killing terminal ${id}`);
    try {
      terminal.pty.kill();
    } catch (error) {
      console.error(`Error killing terminal ${id}:`, error);
    }
  });
  terminals.clear();

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
