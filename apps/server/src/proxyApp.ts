import { api } from "@coderouter/convex/api";
import express from "express";
import type { IncomingMessage, Server } from "http";
import { createProxyServer } from "httpxy";
import { convex } from "./utils/convexClient.js";
import { DockerVSCodeInstance } from "./vscode/DockerVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";

// Helper function to parse host header
function parseHostHeader(
  host: string
): { containerName: string; targetPort: string } | null {
  if (!host) return null;

  const hostParts = host.split(".");
  if (hostParts.length >= 3) {
    return {
      containerName: hostParts[0],
      targetPort: hostParts[1],
    };
  }
  return null;
}

// Loading screen HTML
const loadingScreen = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Starting VSCode Container</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        background-color: #1e1e1e;
        color: #fff;
      }
      .spinner {
        border: 4px solid #333;
        border-top: 4px solid #007acc;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .message {
        font-size: 18px;
        margin-bottom: 10px;
      }
      .container-name {
        font-family: monospace;
        color: #007acc;
      }
    </style>
    <script>
      // Auto-refresh every 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    </script>
  </head>
  <body>
    <div class="spinner"></div>
    <div class="message">Starting VSCode container</div>
    <div class="container-name">{{containerName}}</div>
    <div style="margin-top: 20px; font-size: 14px; color: #888;">
      This page will automatically refresh...
    </div>
  </body>
  </html>
`;

export function createProxyApp(
  vscodeInstances: Map<string, VSCodeInstance>
): express.Application {
  const app = express();

  // Main request handler
  app.use(async (req: express.Request, res: express.Response) => {
    const host = req.get("host");
    if (!host) {
      return res.status(400).send("Host header is required");
    }

    // Parse format: containerName.port.localhost:3001
    const parsed = parseHostHeader(host);
    if (!parsed) {
      return res
        .status(400)
        .send(
          "Invalid subdomain format. Expected: containerName.port.localhost:3001"
        );
    }

    const { containerName, targetPort } = parsed;
    console.log(`Proxy request: ${containerName}.${targetPort} -> ${req.url}`);

    // Look up container information from Convex
    const taskRun = await convex.query(api.taskRuns.getByContainerName, {
      containerName: containerName.startsWith("coderouter-")
        ? containerName
        : `coderouter-${containerName}`,
    });

    if (!taskRun || !taskRun.vscode) {
      // Try to find a VSCode instance that might match this container name
      let matchedInstance: VSCodeInstance | undefined;

      for (const [instanceId, instance] of Array.from(
        vscodeInstances.entries()
      )) {
        if (instance instanceof DockerVSCodeInstance) {
          const instanceContainerName = instance.getContainerName();
          if (
            instanceContainerName === containerName ||
            instanceContainerName === `coderouter-${containerName}` ||
            instanceContainerName.includes(containerName) ||
            containerName.includes(instanceId.substring(0, 12))
          ) {
            matchedInstance = instance;
            break;
          }
        }
      }

      if (!matchedInstance) {
        return res
          .status(404)
          .send(`No VSCode instance found for container: ${containerName}`);
      }

      // Try to start the matched instance
      if (matchedInstance instanceof DockerVSCodeInstance) {
        matchedInstance.start().catch((err) => {
          console.error(`Failed to start container for ${containerName}:`, err);
        });
        return res.send(
          loadingScreen.replace("{{containerName}}", containerName)
        );
      }

      return res
        .status(400)
        .send("Only Docker VSCode instances are supported for proxy");
    }

    const vscodeInfo = taskRun.vscode;

    if (vscodeInfo.status === "starting") {
      return res.send(
        loadingScreen.replace("{{containerName}}", containerName)
      );
    }

    if (vscodeInfo.status === "stopped") {
      const vscodeInstance = vscodeInstances.get(taskRun._id);
      if (vscodeInstance && vscodeInstance instanceof DockerVSCodeInstance) {
        vscodeInstance.start().catch((err) => {
          console.error(`Failed to restart container ${containerName}:`, err);
        });
        return res.send(
          loadingScreen.replace("{{containerName}}", containerName)
        );
      }
      return res
        .status(503)
        .send(`Container ${containerName} is stopped and cannot be restarted`);
    }

    // Container is running, determine target port
    if (!vscodeInfo.ports) {
      return res
        .status(503)
        .send(`Port information not available for container ${containerName}`);
    }

    let actualPort: string | undefined;
    if (targetPort === vscodeInfo.ports.vscode) {
      actualPort = vscodeInfo.ports.vscode;
    } else if (targetPort === vscodeInfo.ports.worker) {
      actualPort = vscodeInfo.ports.worker;
    } else if (targetPort === vscodeInfo.ports.extension) {
      actualPort = vscodeInfo.ports.extension;
    } else {
      actualPort = targetPort;
    }

    if (!actualPort) {
      return res
        .status(400)
        .send(`Port ${targetPort} not found for container ${containerName}`);
    }

    // Create httpxy proxy and proxy the request
    const proxy = createProxyServer({});

    try {
      await proxy.web(req, res, {
        target: `http://localhost:${actualPort}`,
      });
    } catch (error) {
      console.error(`Proxy error for ${containerName}:${actualPort}:`, error);
      if (!res.headersSent) {
        res.status(502).send(`Proxy error: ${error}`);
      }
    }
  });

  return app;
}

// Function to setup WebSocket upgrade handling on the HTTP server
export function setupWebSocketProxy(server: Server) {
  server.on(
    "upgrade",
    async (request: IncomingMessage, socket: any, head: Buffer) => {
      const host = request.headers.host;
      console.log(`WebSocket upgrade request for host: ${host}`);

      if (!host) {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        return;
      }

      // Parse the host header
      const parsed = parseHostHeader(host);
      if (!parsed) {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        return;
      }

      const { containerName, targetPort } = parsed;

      // Look up container information from Convex
      const taskRun = await convex.query(api.taskRuns.getByContainerName, {
        containerName: containerName.startsWith("coderouter-")
          ? containerName
          : `coderouter-${containerName}`,
      });

      if (
        !taskRun ||
        !taskRun.vscode ||
        taskRun.vscode.status !== "running" ||
        !taskRun.vscode.ports
      ) {
        console.error(
          `WebSocket upgrade failed: Container not found or not running for ${containerName}`
        );
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }

      // Determine actual port
      let actualPort: string | undefined;
      const ports = taskRun.vscode.ports;

      if (targetPort === ports.vscode) {
        actualPort = ports.vscode;
      } else if (targetPort === ports.worker) {
        actualPort = ports.worker;
      } else if (targetPort === ports.extension) {
        actualPort = ports.extension;
      } else {
        actualPort = targetPort;
      }

      if (!actualPort) {
        console.error(
          `WebSocket upgrade failed: Port ${targetPort} not found for container ${containerName}`
        );
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }

      // Create httpxy proxy for WebSocket
      const proxy = createProxyServer({
        ws: true,
        changeOrigin: true,
      });

      try {
        console.log(
          `Proxying WebSocket connection for ${containerName}:${actualPort}`
        );
        console.log("request.url", request.url);
        console.log("request.origin", request.headers.origin);
        console.log("request.host", request.headers.host);
        console.log("");

        // Setup error handling before proxying
        proxy.on("error", (err, req, res) => {
          console.error(`WebSocket proxy error:`, err);
        });

        proxy.on("proxyReqWs", (proxyReq, req, socket, options, head) => {
          console.log(
            `WebSocket proxy request initiated to ws://localhost:${actualPort}`
          );
        });

        await proxy.ws(
          request,
          socket,
          {
            target: `ws://localhost:${actualPort}`,
            ws: true,
            changeOrigin: true,
          },
          head
        );
      } catch (error) {
        console.error(
          `WebSocket proxy error for ${containerName}:${actualPort}:`,
          error
        );
        socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      }
    }
  );
}

// Augment Express Request interface
declare global {
  namespace Express {
    interface Request {
      containerName?: string;
      targetPort?: string;
    }
  }
}
