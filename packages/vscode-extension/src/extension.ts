import * as vscode from "vscode";
// import { Server } from "socket.io";
import * as http from "http";

// Create output channel for CodeRouter logs
const outputChannel = vscode.window.createOutputChannel("CodeRouter");

// Log immediately when module loads
console.log("[CodeRouter] Extension module loaded");

// Socket.IO server instance
// let ioServer: Server | null = null;
let httpServer: http.Server | null = null;

// Track active terminals
const activeTerminals = new Map<string, vscode.Terminal>();

function log(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  if (args.length > 0) {
    outputChannel.appendLine(formattedMessage + " " + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(" "));
  } else {
    outputChannel.appendLine(formattedMessage);
  }
}

async function runCodeRouter() {
  log("Starting runCodeRouter function");
  log("CMUX_INITIAL_COMMAND:", process.env.CMUX_INITIAL_COMMAND);

  try {
    // Check current workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      log("Current workspace folders:", workspaceFolders.map(f => f.uri.fsPath));
    } else {
      log("No workspace folder open");
    }

    // Ensure we have a workspace open
    if (!workspaceFolders || workspaceFolders.length === 0) {
      log("Opening /root/workspace as workspace...");
      const workspaceUri = vscode.Uri.file('/root/workspace');
      await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, false);
      log("Workspace opened, waiting for it to load...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Option 1: Always open Source Control view (works even with no changes)
    log("Opening SCM view...");
    await vscode.commands.executeCommand("workbench.view.scm");

    // Open git changes view
    log("Opening git changes view...");
    await vscode.commands.executeCommand("git.viewChanges");

    // Then split the editor area (this will create a split to the right)
    log("Splitting editor...");
    await vscode.commands.executeCommand("workbench.action.splitEditor");

    // Create and show terminal with a command that runs immediately
    // This will appear in the left split (the newly created one)
    log("Creating terminal...");

    // Get the workspace folder path
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : '/root/workspace';
    log("Terminal will be created in directory:", cwd);

    const terminal = vscode.window.createTerminal({
      name: "cmux",
      location: vscode.TerminalLocation.Editor,
      cwd: cwd,
      env: process.env
    });
    log("Terminal created, showing it...");
    terminal.show();
    log("Terminal shown successfully");
    
    // Send the command after terminal is ready
    const commandToRun = process.env.CMUX_INITIAL_COMMAND;
    if (commandToRun) {
      log("Sending command to terminal:", commandToRun);
      // Add a small delay to ensure terminal is ready
      setTimeout(() => {
        terminal.sendText(commandToRun);
        log("Command sent to terminal");
      }, 500);
    } else {
      log("No CMUX_INITIAL_COMMAND found");
    }
  } catch (error) {
    log("ERROR in runCodeRouter:", error);
  }
}

// function startSocketServer() {
//   try {
//     const port = 3004;
//     httpServer = http.createServer();
//     ioServer = new Server(httpServer, {
//       cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//       }
//     });

//     ioServer.on("connection", (socket) => {
//       log("Socket client connected:", socket.id);

//       // Health check
//       socket.on("vscode:ping", (callback) => {
//         log("Received ping from client");
//         callback({ timestamp: Date.now() });
//         socket.emit("vscode:pong");
//       });

//       // Get status
//       socket.on("vscode:get-status", (callback) => {
//         const workspaceFolders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
//         const extensions = vscode.extensions.all.map(e => e.id);
        
//         callback({
//           ready: true,
//           workspaceFolders,
//           extensions
//         });
//       });

//       // Execute command
//       socket.on("vscode:execute-command", async (data, callback) => {
//         log("Execute command request:", data);
        
//         try {
//           const { command, workingDirectory } = data;
          
//           // Create terminal
//           const terminalId = `terminal-${Date.now()}`;
//           const terminal = vscode.window.createTerminal({
//             name: `CodeRouter-${terminalId}`,
//             location: vscode.TerminalLocation.Editor,
//             cwd: workingDirectory || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '/root/workspace'
//           });
          
//           activeTerminals.set(terminalId, terminal);
//           terminal.show();
          
//           // Send terminal created event
//           socket.emit("vscode:terminal-created", {
//             terminalId,
//             name: terminal.name,
//             cwd: workingDirectory || '/root/workspace'
//           });
          
//           // Send command
//           setTimeout(() => {
//             terminal.sendText(command);
//             log("Command sent to terminal:", command);
//           }, 500);
          
//           callback({ success: true });
//         } catch (error: any) {
//           log("Error executing command:", error);
//           callback({ success: false, error: error.message });
//         }
//       });

//       socket.on("disconnect", () => {
//         log("Socket client disconnected:", socket.id);
//       });
//     });

//     httpServer.listen(port, () => {
//       log(`Socket.IO server listening on port ${port}`);
//     });

//     // Emit status update periodically
//     setInterval(() => {
//       if (ioServer) {
//         ioServer.emit("vscode:status", {
//           ready: true,
//           message: "VS Code extension is running",
//           workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || []
//         });
//       }
//     }, 5000);

//   } catch (error) {
//     log("Failed to start Socket.IO server:", error);
//   }
// }

export async function activate(context: vscode.ExtensionContext) {
  console.log("[CodeRouter] activate() called");
  
  // Create command to show output channel
  const showOutputCommand = vscode.commands.registerCommand('coderouter.showOutput', () => {
    outputChannel.show(true);
  });
  context.subscriptions.push(showOutputCommand);
  
  // Show output channel with focus
  outputChannel.show(true);
  outputChannel.appendLine("=== CodeRouter Extension Activating ===");
  
  console.log("[CodeRouter] Output channel should be visible now");
  
  log("Extension is being activated");
  log("Environment variables:", Object.keys(process.env).filter(key => key.includes('CMUX')).reduce((obj, key) => {
    obj[key] = process.env[key];
    return obj;
  }, {} as any));

  // close all editors
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");

  // Start Socket.IO server
  // startSocketServer();

  // Check for initial command on startup
  const initialCommand = process.env.CMUX_INITIAL_COMMAND;
  log("Initial command from env:", initialCommand || "(not set)");

  if (initialCommand) {
    // Wait for VS Code to be fully loaded before running
    log("Scheduling runCodeRouter in 2 seconds...");
    setTimeout(async () => {
      log("Delay complete, running CodeRouter now...");
      await runCodeRouter();
    }, 2000); // 2 second delay to ensure VS Code is ready
  } else {
    log("No CMUX_INITIAL_COMMAND set, skipping auto-run");
  }

  let disposable = vscode.commands.registerCommand(
    "coderouter.helloWorld",
    async () => {
      log("Hello World from CodeRouter!");
      vscode.window.showInformationMessage("Hello World from CodeRouter!");
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    }
  );

  let run = vscode.commands.registerCommand("coderouter.run", async () => {
    await runCodeRouter();
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(run);
}

export function deactivate() {
  log("CodeRouter extension is now deactivated!");
  
  // Clean up Socket.IO server
  // if (ioServer) {
  //   ioServer.close();
  //   ioServer = null;
  // }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  
  // Clean up terminals
  activeTerminals.forEach(terminal => terminal.dispose());
  activeTerminals.clear();
  
  outputChannel.dispose();
}
