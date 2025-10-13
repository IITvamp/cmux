import type { ServerWebSocket } from "bun";
import WebSocketClient from "ws";
import { createApp } from "./app.js";

// Disable SSL certificate verification for backend requests
// This is needed because morph.so backends may have invalid certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = createApp();

interface WebSocketData {
  morphId: string;
  port: number;
  pathname: string;
  search: string;
  backendWs?: WebSocketClient;
}

console.log(`Starting cmux-proxy server on port ${PORT}...`);

Bun.serve<WebSocketData>({
  port: PORT,
  hostname: "0.0.0.0",

  async fetch(req, server) {
    const url = new URL(req.url);
    const hostname = req.headers.get("host") || url.hostname;
    const upgradeHeader = req.headers.get("upgrade");

    // Check if this is a WebSocket upgrade request
    if (upgradeHeader?.toLowerCase() === "websocket") {
      console.log(`[WebSocket] Upgrade request detected for ${hostname}${url.pathname}`);

      // Parse hostname to extract morphId and port
      // Format: cmux-{morphId}-{scope}-{port}.{cmux.app|cmux.sh|autobuild.app}
      // The port is always the last segment before the domain
      const match = hostname.match(/^cmux-([^-]+)-.*-(\d+)\.(?:cmux\.(?:app|sh)|autobuild\.app)$/);

      if (!match) {
        console.error(`[WebSocket] Invalid hostname format: ${hostname}`);
        return new Response("Invalid hostname format", { status: 400 });
      }

      const [, morphId, portStr] = match;
      const port = parseInt(portStr, 10);

      console.log(`[WebSocket] Parsed: morphId=${morphId}, port=${port}`);

      // Upgrade the connection
      const success = server.upgrade(req, {
        data: {
          morphId,
          port,
          pathname: url.pathname,
          search: url.search,
        },
      });

      if (!success) {
        console.error(`[WebSocket] Failed to upgrade connection`);
        return new Response("Failed to upgrade to WebSocket", { status: 500 });
      }

      return undefined; // Connection upgraded
    }

    // Regular HTTP request - pass to Hono app
    return app.fetch(req);
  },

  websocket: {
    async open(ws: ServerWebSocket<WebSocketData>) {
      const { morphId, port, pathname, search } = ws.data;
      const backendUrl = `wss://port-39379-morphvm-${morphId}.http.cloud.morph.so${pathname}${search}`;

      console.log(`[WebSocket] Client connected, connecting to backend: ${backendUrl}`);
      console.log(`[WebSocket] Routing to internal port: ${port}`);

      try {
        // Use ws library to connect with custom headers
        const backendWs = new WebSocketClient(backendUrl, {
          headers: {
            "Host": `port-39379-morphvm-${morphId}.http.cloud.morph.so`,
            "X-Cmux-Port-Internal": String(port),
            "X-Cmux-Proxied": "true",
          },
          rejectUnauthorized: false, // Accept self-signed certificates
        });

        // Store backend WebSocket in client WebSocket data
        ws.data.backendWs = backendWs;

        // Wait for backend connection to open
        backendWs.on("open", () => {
          console.log(`[WebSocket] Backend connection established`);
        });

        // Forward messages from backend to client
        backendWs.on("message", (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            // Convert ws RawData to Buffer for Bun's WebSocket
            const buffer = Buffer.isBuffer(data)
              ? data
              : Array.isArray(data)
              ? Buffer.concat(data as Buffer[])
              : Buffer.from(data as ArrayBuffer);
            ws.send(buffer);
          }
        });

        // Handle backend connection close
        backendWs.on("close", (code, reason) => {
          console.log(`[WebSocket] Backend closed: code=${code}, reason=${reason.toString()}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(code, reason.toString());
          }
        });

        // Handle backend errors
        backendWs.on("error", (error) => {
          console.error(`[WebSocket] Backend error:`, error);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, "Backend error");
          }
        });

      } catch (error) {
        console.error(`[WebSocket] Failed to connect to backend:`, error);
        ws.close(1011, "Failed to connect to backend");
      }
    },

    async message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
      const { backendWs } = ws.data;

      if (backendWs && backendWs.readyState === WebSocketClient.OPEN) {
        backendWs.send(message);
      } else {
        console.error(`[WebSocket] Cannot send message: backend not connected`);
      }
    },

    async close(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
      console.log(`[WebSocket] Client closed: code=${code}, reason=${reason}`);

      const { backendWs } = ws.data;
      if (backendWs && backendWs.readyState === WebSocketClient.OPEN) {
        backendWs.close(code, reason);
      }
    },
  },
});

console.log(`cmux-proxy listening on http://0.0.0.0:${PORT}`);
