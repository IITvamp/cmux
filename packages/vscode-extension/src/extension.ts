import * as http from "http";
import { Server } from "socket.io";
import { io } from "socket.io-client";
import * as vscode from "vscode";

// Create output channel for CodeRouter logs
const outputChannel = vscode.window.createOutputChannel("CodeRouter");

// Log immediately when module loads
console.log("[CodeRouter] Extension module loaded");

// Socket.IO server instance
let ioServer: Server | null = null;
let httpServer: http.Server | null = null;
let workerSocket: ReturnType<typeof io> | null = null;

// Track active terminals
const activeTerminals = new Map<string, vscode.Terminal>();
let isSetupComplete = false;

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  if (args.length > 0) {
    outputChannel.appendLine(
      formattedMessage +
        " " +
        args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
          )
          .join(" ")
    );
  } else {
    outputChannel.appendLine(formattedMessage);
  }
}

async function openMultiDiffEditor() {
  // Get the Git extension
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (!gitExtension) {
    vscode.window.showErrorMessage("Git extension not found");
    return;
  }

  const git = gitExtension.exports;
  const api = git.getAPI(1);

  // Get the first repository (or you can select a specific one)
  const repository = api.repositories[0];
  if (!repository) {
    vscode.window.showErrorMessage("No Git repository found");
    return;
  }

  // The resource group IDs are: 'index', 'workingTree', 'untracked', 'merge'
  // You can open the working tree changes view even if empty
  await vscode.commands.executeCommand("_workbench.openScmMultiDiffEditor", {
    title: `Git: Changes`,
    repositoryUri: vscode.Uri.file(repository.rootUri.fsPath),
    resourceGroupId: "workingTree",
  });
}

async function setupTerminalsFromWorker(
  terminals: Array<{ terminalId: string; taskId?: string }>
) {
  log(`Received ${terminals.length} active terminals from worker`);

  // Filter to only use the default terminal
  // terminals = terminals.filter((t) => t.terminalId === "default");
  // log(`Filtered to ${terminals.length} default terminal(s)`);

  // Prevent duplicate setup
  if (isSetupComplete) {
    log("Setup already complete, skipping");
    return;
  }

  // if an existing editor is called "bash", early return
  const activeEditors = vscode.window.visibleTextEditors;
  for (const editor of activeEditors) {
    if (editor.document.fileName === "bash") {
      log("Bash editor already exists, skipping terminal setup");
      return;
    }
  }

  isSetupComplete = true; // Set this BEFORE creating UI elements to prevent race conditions

  // Open Source Control view
  log("Opening SCM view...");
  await vscode.commands.executeCommand("workbench.view.scm");

  // Open git changes view
  log("Opening git changes view...");
  await openMultiDiffEditor();

  // Create terminals for each tmux session
  for (let i = 0; i < terminals.length; i++) {
    const terminalInfo = terminals[i];
    log(
      `Creating terminal ${i + 1}/${terminals.length} for tmux session ${terminalInfo.terminalId}`
    );

    // Split editor for additional terminals
    if (i > 0) {
      await vscode.commands.executeCommand("workbench.action.splitEditor");
    }

    const terminal = vscode.window.createTerminal({
      name: `Session: ${terminalInfo.terminalId}`,
      location: vscode.TerminalLocation.Editor,
      cwd: "/root/workspace",
      env: process.env,
    });

    terminal.show();

    // Store terminal reference
    activeTerminals.set(terminalInfo.terminalId, terminal);

    // Attach to tmux session with a small delay to ensure it's ready
    setTimeout(() => {
      terminal.sendText(`tmux attach-session -t ${terminalInfo.terminalId}`);
      log(`Attached to tmux session ${terminalInfo.terminalId}`);
    }, 500); // 500ms delay to ensure tmux session is ready
  }

  log(`Created ${terminals.length} terminal(s) successfully`);

  // After all terminals are created, ensure the terminal is active and move to right group
  setTimeout(async () => {
    // Focus on the terminal tab
    if (activeTerminals.size > 0) {
      const firstTerminal = activeTerminals.values().next().value;
      if (firstTerminal) {
        firstTerminal.show();
      }
    }

    // Move the active editor (terminal) to the right group
    log("Moving terminal editor to right group");
    await vscode.commands.executeCommand(
      "workbench.action.moveEditorToRightGroup"
    );

    // Ensure terminal has focus
    await vscode.commands.executeCommand("workbench.action.terminal.focus");

    log("Terminal setup complete");
  }, 100);
}

function connectToWorker() {
  if (workerSocket && workerSocket.connected) {
    log("Worker socket already connected");
    return;
  }

  log("Creating worker socket connection...");

  // Clean up existing socket if any
  if (workerSocket) {
    workerSocket.removeAllListeners();
    workerSocket.disconnect();
  }

  workerSocket = io("http://localhost:2377/client", {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Set up event handlers only once
  workerSocket.once("connect", () => {
    log("Connected to worker socket server");
    // Request terminals only on first connection
    if (!isSetupComplete) {
      log("Requesting active terminals...");
      workerSocket!.emit("get-active-terminals");
    }
  });

  workerSocket.on("active-terminals", setupTerminalsFromWorker);

  workerSocket.on("disconnect", () => {
    log("Disconnected from worker socket server");
  });

  workerSocket.on("error", (error) => {
    log("Worker socket error:", error);
  });

  // Handle reconnection without duplicating setup
  workerSocket.on("reconnect", () => {
    log("Reconnected to worker socket server");
    // Don't request terminals again on reconnect
  });
}

function startSocketServer() {
  try {
    const port = 2378;
    httpServer = http.createServer();
    ioServer = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    ioServer.on("connection", (socket) => {
      log("Socket client connected:", socket.id);

      // Health check
      socket.on("vscode:ping", (callback) => {
        log("Received ping from client");
        callback({ timestamp: Date.now() });
        socket.emit("vscode:pong");
      });

      // Get status
      socket.on("vscode:get-status", (callback) => {
        const workspaceFolders =
          vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
        const extensions = vscode.extensions.all.map((e) => e.id);

        callback({
          ready: true,
          workspaceFolders,
          extensions,
        });
      });

      // Execute command
      socket.on("vscode:execute-command", async (data, callback) => {
        try {
          const { command, args = [] } = data;
          log(`Executing command: ${command}`, args);
          const result = await vscode.commands.executeCommand(command, ...args);
          callback({ success: true, result });
        } catch (error: any) {
          log(`Command execution failed:`, error);
          callback({ success: false, error: error.message });
        }
      });

      // Terminal operations
      socket.on("vscode:create-terminal", (data, callback) => {
        try {
          const { name = "Terminal", command } = data;
          const terminal = vscode.window.createTerminal({
            name,
            location: vscode.TerminalLocation.Panel,
          });
          terminal.show();
          if (command) {
            terminal.sendText(command);
          }
          callback({ success: true });
        } catch (error: any) {
          callback({ success: false, error: error.message });
        }
      });

      socket.on("disconnect", () => {
        log("Socket client disconnected:", socket.id);
      });
    });

    httpServer.listen(port, () => {
      log(`Socket.IO server listening on port ${port}`);
    });
  } catch (error) {
    log("Failed to start Socket.IO server:", error);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Log activation
  console.log("[CodeRouter] activate() called");
  log("[CodeRouter] activate() called");

  // Register command to show output
  let showOutputCommand = vscode.commands.registerCommand(
    "coderouter.showOutput",
    () => {
      outputChannel.show();
    }
  );
  context.subscriptions.push(showOutputCommand);

  // Log activation without showing output channel
  outputChannel.appendLine("=== CodeRouter Extension Activating ===");

  log("[CodeRouter] Extension activated, output channel ready");

  // Ensure output panel is hidden on activation
  vscode.commands.executeCommand("workbench.action.closePanel");

  log("Coderouter is being activated");

  // Start Socket.IO server
  startSocketServer();

  // Connect to worker immediately and set up handlers
  connectToWorker();

  let disposable = vscode.commands.registerCommand(
    "coderouter.helloWorld",
    async () => {
      log("Hello World from CodeRouter!");
      vscode.window.showInformationMessage("Hello World from CodeRouter!");
    }
  );

  let run = vscode.commands.registerCommand("coderouter.run", async () => {
    // Force request terminals again
    if (workerSocket && workerSocket.connected) {
      log("Manually requesting terminals...");
      isSetupComplete = false; // Allow setup to run again
      workerSocket.emit("get-active-terminals");
    } else {
      connectToWorker();
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(run);
}

export function deactivate() {
  log("CodeRouter extension is now deactivated!");
  isSetupComplete = false;

  // Clean up worker socket
  if (workerSocket) {
    workerSocket.removeAllListeners();
    workerSocket.disconnect();
    workerSocket = null;
  }

  // Clean up Socket.IO server
  if (ioServer) {
    ioServer.close();
    ioServer = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }

  // Clean up terminals
  activeTerminals.forEach((terminal) => terminal.dispose());
  activeTerminals.clear();

  outputChannel.dispose();
}
