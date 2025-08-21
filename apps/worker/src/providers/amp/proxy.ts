import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type StartOptions = {
  port?: number;
  host?: string;
  upstreamUrl?: string;
  onTaskComplete?: (taskRunId: string) => void;
};

// Cache for completed taskRunIds to avoid duplicate emits
const completedTaskIds = new Set<string>();

async function getRealAmpApiKey(): Promise<string | undefined> {
  // Read exactly from ~/.local/share/amp/secrets.json using the AMP key name
  try {
    const home = process.env.HOME || "/root";
    const secretsPath = join(home, ".local", "share", "amp", "secrets.json");
    const content = await readFile(secretsPath, "utf-8");
    const json = JSON.parse(content) as Record<string, unknown>;
    const key = json["apiKey@https://ampcode.com/"];
    if (typeof key === "string" && key.trim().length > 0) return key.trim();
  } catch {
    // ignore
  }
  return undefined;
}

function extractBearer(req: IncomingMessage): string | undefined {
  const auth = req.headers["authorization"];
  if (!auth) return undefined;
  const str = Array.isArray(auth) ? auth[0] : auth;
  const m = /^Bearer\s+(.+)$/i.exec(str || "");
  return m?.[1];
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

export async function startAmpProxyServer(options: StartOptions = {}): Promise<void> {
  const port = options.port ?? 39380;
  const host = options.host ?? "127.0.0.1"; // bind to localhost only
  const upstreamUrl = options.upstreamUrl ?? process.env.AMP_UPSTREAM_URL ?? "https://ampcode.com";
  const onTaskComplete = options.onTaskComplete;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const realApiKey = await getRealAmpApiKey();
      const url = new URL(req.url || "/", upstreamUrl);
      const targetUrl = upstreamUrl + url.pathname + (url.search || "");

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "undefined") continue;
        if (key.toLowerCase() === "host") continue;
        if (Array.isArray(value)) {
          headers.set(key, value.join(", "));
        } else {
          headers.set(key, value);
        }
      }

      // Replace Authorization and API key headers with real API key if available
      const incomingBearer = extractBearer(req);
      if (realApiKey) {
        // Replace Authorization with Bearer token only (no fallbacks)
        headers.set("authorization", `Bearer ${realApiKey}`);
      }

      let bodyBuffer: Buffer | undefined = undefined;
      let parsedJson: unknown = undefined;

      if (req.method && req.method !== "GET" && req.method !== "HEAD") {
        bodyBuffer = await readRequestBody(req);
        const contentType = (req.headers["content-type"] || "").toString();
        if (contentType.includes("application/json")) {
          try {
            parsedJson = JSON.parse(bodyBuffer.toString("utf-8"));
          } catch {
            // Ignore parse errors; forward raw body
          }
        }
      }

      // Detect completion from request body if present
      try {
        if (parsedJson && typeof parsedJson === "object") {
          const obj = parsedJson as Record<string, unknown>;
          const params = obj["params"];
          const thread =
            params && typeof params === "object"
              ? (params as Record<string, unknown>)["thread"]
              : undefined;
          const messages =
            thread && typeof thread === "object"
              ? (thread as Record<string, unknown>)["messages"]
              : undefined;
          if (Array.isArray(messages)) {
            const complete = messages.some((m) => {
              if (!m || typeof m !== "object") return false;
              const state = (m as Record<string, unknown>)["state"];
              if (!state || typeof state !== "object") return false;
              const t = (state as Record<string, unknown>)["type"];
              return t === "complete";
            });
            if (complete && incomingBearer && !completedTaskIds.has(incomingBearer)) {
              completedTaskIds.add(incomingBearer);
              onTaskComplete?.(incomingBearer);
            }
          }
        }
      } catch {
        // ignore detection errors
      }

      const proxyResp = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: bodyBuffer,
        redirect: "manual",
      });

      const outHeaders = new Headers(proxyResp.headers);
      outHeaders.delete("content-encoding");
      outHeaders.delete("content-length");

      const arrayBuffer = await proxyResp.arrayBuffer();
      const headerObj: Record<string, string> = {};
      outHeaders.forEach((value, key) => {
        headerObj[key] = value;
      });
      res.writeHead(proxyResp.status, headerObj);
      res.end(Buffer.from(arrayBuffer));
    } catch {
      res.statusCode = 502;
      res.end("Bad Gateway");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
    server.on("error", () => resolve()); // If already in use, do not crash
  });
}

export default startAmpProxyServer;
