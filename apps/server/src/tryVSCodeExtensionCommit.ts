import { serverLogger } from "./utils/fileLogger";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance";
import { VSCodeInstance } from "./vscode/VSCodeInstance";

/**
 * Try to use VSCode extension API for git operations
 */

export async function tryVSCodeExtensionCommit(
  vscodeInstance: VSCodeInstance,
  branchName: string,
  commitMessage: string,
  agentName: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // For Docker instances, get the extension port
    let extensionPort: string | undefined;
    if (vscodeInstance instanceof DockerVSCodeInstance) {
      const ports = (vscodeInstance as DockerVSCodeInstance).getPorts();
      extensionPort = ports?.extension;
    }

    if (!extensionPort) {
      return { success: false, error: "Extension port not available" };
    }

    // Connect to VSCode extension socket
    const { io } = await import("socket.io-client");
    const extensionSocket = io(`http://localhost:${extensionPort}`, {
      timeout: 10000,
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        extensionSocket.disconnect();
        resolve({
          success: false,
          error: "Timeout connecting to VSCode extension",
        });
      }, 15000);

      extensionSocket.on("connect", () => {
        serverLogger.info(
          `[AgentSpawner] Connected to VSCode extension on port ${extensionPort}`
        );

        extensionSocket.emit(
          "vscode:auto-commit-push",
          {
            branchName,
            commitMessage,
            agentName,
          },
          (response: any) => {
            clearTimeout(timeout);
            extensionSocket.disconnect();

            if (response.success) {
              resolve({ success: true, message: response.message });
            } else {
              resolve({ success: false, error: response.error });
            }
          }
        );
      });

      extensionSocket.on("connect_error", (error) => {
        clearTimeout(timeout);
        extensionSocket.disconnect();
        resolve({
          success: false,
          error: `Connection error: ${error.message}`,
        });
      });
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
