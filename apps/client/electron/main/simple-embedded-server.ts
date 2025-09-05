import { ipcSocketServer } from "./ipc-socket-server";
import type { 
  GitRepoInfo,
  AvailableEditors,
  ServerToClientEvents,
  ClientToServerEvents
} from "@cmux/shared";

// Simplified embedded server that provides basic socket functionality
// without requiring the full server dependencies
export function startSimpleEmbeddedServer(defaultRepo?: GitRepoInfo | null) {
  console.log("[SimpleEmbeddedServer] Starting simplified embedded server with IPC transport");
  
  // Handle socket connections
  ipcSocketServer.on("connection", (ipcSocket: any) => {
    const socket = ipcSocketServer.wrapSocket(ipcSocket);
    console.log("[SimpleEmbeddedServer] New IPC socket connection:", socket.id);
    
    // Send available editors on connection
    const availableEditors: AvailableEditors = {
      vscode: { available: false, reason: "Not available in Electron mode" },
      cursor: { available: false, reason: "Not available in Electron mode" },
      windsurf: { available: false, reason: "Not available in Electron mode" },
    };
    socket.emit("available-editors", availableEditors);
    
    // Handle basic socket events
    socket.on("ping", () => {
      console.log("[SimpleEmbeddedServer] Received ping");
      socket.emit("pong");
    });
    
    // Handle authentication check
    socket.on("check-auth", () => {
      // In Electron mode, we trust the auth from the renderer
      socket.emit("auth-status", { authenticated: true });
    });
    
    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("[SimpleEmbeddedServer] Socket disconnected:", socket.id);
    });
    
    // Log unhandled events for debugging
    const events: (keyof ClientToServerEvents)[] = [
      "start-task",
      "archive-task",
      "list-files",
      "git-full-diff",
      "spawn-from-comment",
      "open-in-editor",
      "github-fetch-repos",
      "github-fetch-branches",
      "github-merge-branch",
      "github-create-draft-pr",
    ];
    
    for (const event of events) {
      socket.on(event, (...args: any[]) => {
        console.log(`[SimpleEmbeddedServer] Received ${event} event (not implemented in Electron mode)`, args);
        // Send a placeholder response to avoid hanging
        if (event === "list-files") {
          socket.emit("list-files-response", { files: [] });
        }
      });
    }
  });
  
  console.log("[SimpleEmbeddedServer] Simplified embedded server started successfully");
}