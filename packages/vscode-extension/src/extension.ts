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

// Track active terminals
const activeTerminals = new Map<string, vscode.Terminal>();

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

async function connectToWorkerTerminals() {
  log("Connecting to worker to get active terminals");

  try {
    // Connect to worker socket server
    const workerSocket = io("http://localhost:3002", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    workerSocket.on("connect", () => {
      log("Connected to worker socket server");

      // Request active terminals
      workerSocket.emit("get-active-terminals");
    });

    workerSocket.on(
      "active-terminals",
      async (terminals: Array<{ terminalId: string; taskId?: string }>) => {
        log(`Received ${terminals.length} active terminals from worker`);

        if (terminals.length === 0) {
          log("No active terminals found");
          return;
        }

        // Open workspace if needed
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          log("Opening /root/workspace as workspace...");
          const workspaceUri = vscode.Uri.file("/root/workspace");
          await vscode.commands.executeCommand(
            "vscode.openFolder",
            workspaceUri,
            false
          );
          log("Workspace opened, waiting for it to load...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

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

          // Split editor only for terminals after the first one
          if (i > 0) {
            await vscode.commands.executeCommand(
              "workbench.action.splitEditor"
            );
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

          // Attach to tmux session
          setTimeout(() => {
            terminal.sendText(
              `tmux attach-session -t ${terminalInfo.terminalId}`
            );
            log(`Attached to tmux session ${terminalInfo.terminalId}`);
          }, 500);
        }

        log(`Created ${terminals.length} terminal(s) successfully`);

        // Disconnect from worker after getting terminals
        workerSocket.disconnect();
      }
    );

    workerSocket.on("connect_error", (error) => {
      log("Failed to connect to worker:", error.message);
    });
  } catch (error) {
    log("Error connecting to worker terminals:", error);
  }
}

function startSocketServer() {
  try {
    const port = 3004;
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
        log("Execute command request:", data);

        try {
          const { command, workingDirectory } = data;

          // Create terminal
          const terminalId = `terminal-${Date.now()}`;
          const terminal = vscode.window.createTerminal({
            name: `Coderouter-${terminalId}`,
            location: vscode.TerminalLocation.Editor,
            cwd:
              workingDirectory ||
              vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
              "/root/workspace",
          });

          activeTerminals.set(terminalId, terminal);
          terminal.show();

          // Send terminal created event
          socket.emit("vscode:terminal-created", {
            terminalId,
            name: terminal.name,
            cwd: workingDirectory || "/root/workspace",
          });

          // Send command
          setTimeout(() => {
            terminal.sendText(command);
            log("Command sent to terminal:", command);
          }, 500);

          callback({ success: true });
        } catch (error: any) {
          log("Error executing command:", error);
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

    // Emit status update periodically
    setInterval(() => {
      if (ioServer) {
        ioServer.emit("vscode:status", {
          ready: true,
          message: "VS Code extension is running",
          workspaceFolders:
            vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [],
        });
      }
    }, 5000);
  } catch (error) {
    log("Failed to start Socket.IO server:", error);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  log("[CodeRouter] activate() called");

  // Create command to show output channel
  const showOutputCommand = vscode.commands.registerCommand(
    "coderouter.showOutput",
    () => {
      outputChannel.show(true);
    }
  );
  context.subscriptions.push(showOutputCommand);

  // Show output channel with focus
  outputChannel.show(true);
  outputChannel.appendLine("=== CodeRouter Extension Activating ===");

  log("[CodeRouter] Output channel should be visible now");

  log("Coderouter is being activated");

  // close all editors
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");

  // Start Socket.IO server
  startSocketServer();

  // Connect to worker terminals on startup
  log("Scheduling connection to worker terminals in 2 seconds...");
  setTimeout(async () => {
    log("Delay complete, connecting to worker terminals now...");
    await connectToWorkerTerminals();
  }, 2000); // 2 second delay to ensure VS Code is ready

  let disposable = vscode.commands.registerCommand(
    "coderouter.helloWorld",
    async () => {
      log("Hello World from CodeRouter!");
      vscode.window.showInformationMessage("Hello World from CodeRouter!");
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    }
  );

  let run = vscode.commands.registerCommand("coderouter.run", async () => {
    await connectToWorkerTerminals();
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(run);
}

export function deactivate() {
  log("CodeRouter extension is now deactivated!");

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
