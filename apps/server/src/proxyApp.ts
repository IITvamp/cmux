import * as express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  containerMappings,
  DockerVSCodeInstance,
} from "./vscode/DockerVSCodeInstance.js";
import { VSCodeInstance } from "./vscode/VSCodeInstance.js";

export function createProxyApp(
  vscodeInstances: Map<string, VSCodeInstance>
): express.Application {
  const app = express.default();

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

  // Middleware to parse subdomain and port
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const host = req.get("host");
      if (!host) {
        return res.status(400).send("Host header is required");
      }

      // Parse format: containerName.port.localhost:3001
      const hostParts = host.split(".");

      // Expected format: [containerName, port, localhost:3001] or [containerName, port, localhost]
      if (hostParts.length >= 3) {
        const containerName = hostParts[0];
        const targetPort = hostParts[1];

        // Store parsed info for later use
        req.containerName = containerName;
        req.targetPort = targetPort;

        console.log(
          `Proxy request: ${containerName}.${targetPort} -> ${req.url}`
        );
      }

      next();
    }
  );

  // Main proxy handler
  app.use(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const { containerName, targetPort } = req as any;

      if (!containerName || !targetPort) {
        return res
          .status(400)
          .send(
            "Invalid subdomain format. Expected: containerName.port.localhost:3001"
          );
      }

      // Look for mapping by container name (could be with or without coderouter-vscode- prefix)
      let mapping = containerMappings.get(`coderouter-vscode-${containerName}`);
      if (!mapping) {
        mapping = containerMappings.get(containerName);
      }

      if (!mapping) {
        // Try to find a VSCode instance that might match this container name
        // Look through all instances to see if any have a matching container name pattern
        let matchedInstance: VSCodeInstance | undefined;

        for (const [instanceId, instance] of Array.from(
          vscodeInstances.entries()
        )) {
          if (instance instanceof DockerVSCodeInstance) {
            // Check if the instance ID or any part matches the container name
            if (
              instanceId.includes(containerName) ||
              containerName.includes(instanceId)
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
          // Start container in background
          matchedInstance.start().catch((err) => {
            console.error(
              `Failed to start container for ${containerName}:`,
              err
            );
          });

          // Show loading screen
          return res.send(
            loadingScreen.replace("{{containerName}}", containerName)
          );
        }

        return res
          .status(400)
          .send("Only Docker VSCode instances are supported for proxy");
      }

      if (mapping.status === "starting") {
        // Show loading screen
        return res.send(
          loadingScreen.replace("{{containerName}}", containerName)
        );
      }

      if (mapping.status === "stopped") {
        // Try to restart the container
        const vscodeInstance = vscodeInstances.get(mapping.instanceId);
        if (vscodeInstance && vscodeInstance instanceof DockerVSCodeInstance) {
          // Start container in background
          vscodeInstance.start().catch((err) => {
            console.error(`Failed to restart container ${containerName}:`, err);
          });

          // Show loading screen
          return res.send(
            loadingScreen.replace("{{containerName}}", containerName)
          );
        }

        return res
          .status(503)
          .send(
            `Container ${containerName} is stopped and cannot be restarted`
          );
      }

      // Container is running, determine target port
      let actualPort: string | undefined;

      if (targetPort === mapping.ports.vscode) {
        actualPort = mapping.ports.vscode;
      } else if (targetPort === mapping.ports.worker) {
        actualPort = mapping.ports.worker;
      } else if (targetPort === mapping.ports.extension) {
        actualPort = mapping.ports.extension;
      } else {
        // Allow direct port mapping - maybe they know a specific port
        actualPort = targetPort;
      }

      if (!actualPort) {
        return res
          .status(400)
          .send(`Port ${targetPort} not found for container ${containerName}`);
      }

      // Create proxy middleware
      const proxy = createProxyMiddleware({
        target: `http://localhost:${actualPort}`,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
        on: {
          error: (
            err: Error,
            req: express.Request,
            res: express.Response | any
          ) => {
            console.error(
              `Proxy error for ${containerName}:${actualPort}:`,
              err.message
            );
            if (res && res.status && !res.headersSent) {
              res.status(502).send(`Proxy error: ${err.message}`);
            }
          },
          proxyReq: (
            proxyReq: any,
            req: express.Request,
            res: express.Response
          ) => {
            // Log proxy requests
            console.log(
              `Proxying ${req.method} ${req.url} -> localhost:${actualPort}${req.url}`
            );
          },
        },
      });

      // Use the proxy middleware
      proxy(req, res, next);
    }
  );

  return app;
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
