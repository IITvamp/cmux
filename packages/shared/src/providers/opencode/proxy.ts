import { createServer as createHttpServer } from "node:http";

export type OpencodeProxyOptions = {
  // URL of the upstream OpenCode server (the real server the CLI talks to)
  upstreamUrl?: string; // defaults to http://127.0.0.1:4096
  workerId?: string;
  emitToMainServer?: (event: string, payload: unknown) => void;
};

// Local proxy port (separate from AMP's proxy)
const OPENCODE_PROXY_PORT = 39380;

function extractTaskRunIdFromPath(urlPath: string | undefined | null): string | null {
  if (!urlPath) return null;
  // We expect URLs like: /task/<taskRunId>/session/messages ...
  const m = urlPath.match(/^\/?task\/([a-zA-Z0-9_-]{8,64})(?:\/|$)/);
  return m?.[1] || null;
}

function stripTaskPrefix(urlPath: string | undefined | null): string {
  if (!urlPath) return "/";
  return urlPath.replace(/^\/?task\/([a-zA-Z0-9_-]{8,64})(?=\/|$)/, "");
}

// Heuristic: determine completion from OpenCode JSON response bodies
// We look for assistant messages with a completed time or finish markers.
function opencodeResponseIndicatesCompletion(json: unknown): boolean {
  if (json == null) return false;

  // Single object payload
  if (typeof json === "object" && !Array.isArray(json)) {
    // Shape may be { info, parts } or a single Message
    const obj = json as Record<string, unknown>;

    // Try { info, parts }
    if (obj.info && typeof obj.info === "object") {
      const info = obj.info as Record<string, unknown>;
      if (String(info["role"]) === "assistant") {
        const time = info["time"] as Record<string, unknown> | undefined;
        const completed = Number((time as any)?.completed || 0);
        if (completed > 0) return true;
      }
    }

    // Try raw Message with role/time
    const role = String((obj as any)?.role || "");
    if (role === "assistant") {
      const time = (obj as any)?.time as { completed?: number } | undefined;
      if (time && typeof time.completed === "number" && time.completed > 0) {
        return true;
      }
    }

    // Check for generic finish markers
    const finish = (obj as any)?.finish || (obj as any)?.response?.finish;
    const finishReason = String((finish?.reason ?? "").toString().toLowerCase());
    if (finishReason && finishReason !== "tool_use") return true;

    // Some payloads may be nested arrays of { info, parts }
  }

  // Array of items (possibly { info, parts }[] or Message[])
  if (Array.isArray(json)) {
    // Iterate most recent items first
    for (let i = json.length - 1; i >= 0; i--) {
      const item = json[i] as any;
      if (!item || typeof item !== "object") continue;

      // { info, parts }
      const info = item.info as any;
      if (info && typeof info === "object") {
        if (String(info.role) === "assistant") {
          const completed = Number(info?.time?.completed || 0);
          if (completed > 0) return true;
        }
        continue;
      }

      // Raw Message
      if (String(item.role) === "assistant") {
        const completed = Number(item?.time?.completed || 0);
        if (completed > 0) return true;
      }
    }
  }

  return false;
}

export function startOpencodeProxy(options: OpencodeProxyOptions = {}) {
  const OPENCODE_TARGET_HOST = options.upstreamUrl || process.env.OPENCODE_UPSTREAM_URL || "http://127.0.0.1:4096";
  const emit = options.emitToMainServer || (() => {});
  const workerId = options.workerId;

  // Prevent duplicate emits per taskRunId
  const completedTasks = new Set<string>();

  (async () => {
    const server = createHttpServer(async (req, res) => {
      const start = Date.now();
      const origUrl = req.url || "/";
      const taskRunId = extractTaskRunIdFromPath(origUrl);
      const forwardPath = stripTaskPrefix(origUrl) || "/";
      const targetUrl = `${OPENCODE_TARGET_HOST}${forwardPath.startsWith("/") ? "" : "/"}${forwardPath}`;

      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

      req.on("end", async () => {
        const reqBuffer = Buffer.concat(chunks);
        const contentType = (req.headers["content-type"] || "") as string;

        // Clone headers for upstream, removing hop-by-hop headers
        const upstreamHeaders = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value == null) continue;
          const lower = key.toLowerCase();
          if (lower === "host" || lower === "content-length") continue;
          if (Array.isArray(value)) upstreamHeaders.set(key, value.join(", "));
          else upstreamHeaders.set(key, String(value));
        }

        let bodyForFetch: string | Buffer | undefined;
        let loggedRequestBody: unknown = undefined;
        if (req.method && req.method !== "GET" && req.method !== "HEAD") {
          if (contentType.includes("application/json")) {
            const text = reqBuffer.toString("utf8");
            bodyForFetch = text;
            try {
              loggedRequestBody = JSON.parse(text);
            } catch {
              loggedRequestBody = text;
            }
          } else {
            bodyForFetch = reqBuffer;
          }
        }

        try {
          const proxyResponse = await fetch(targetUrl, {
            method: req.method,
            headers: upstreamHeaders,
            body: bodyForFetch as any,
            redirect: "manual",
          });

          // Copy response headers
          const responseHeaders = new Headers(proxyResponse.headers);
          responseHeaders.delete("content-encoding");
          responseHeaders.delete("content-length");

          res.statusCode = proxyResponse.status;
          res.statusMessage = proxyResponse.statusText;
          responseHeaders.forEach((v, k) => res.setHeader(k, v));

          // Detect completion from JSON responses where possible
          const responseContentType = proxyResponse.headers.get("content-type") || "";

          // Special case: SSE should be proxied as a stream without buffering
          if (responseContentType.includes("text/event-stream")) {
            // Pipe through raw without inspection
            const reader = proxyResponse.body?.getReader();
            if (reader) {
              const pump = async () => {
                try {
                  while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) res.write(Buffer.from(value));
                  }
                } catch {
                  // ignore
                } finally {
                  res.end();
                }
              };
              void pump();
              return;
            } else {
              // Fallback if body is not readable (unlikely)
              res.end();
              return;
            }
          }

          let responseBodyForClient: string | Uint8Array | null = null;
          let parsedJson: unknown = undefined;
          try {
            if (
              typeof responseContentType === "string" &&
              (responseContentType.includes("application/json") ||
                responseContentType.startsWith("text/"))
            ) {
              const text = await proxyResponse.text();
              responseBodyForClient = text;
              try {
                parsedJson = JSON.parse(text);
              } catch {
                // non-JSON text
              }
            } else {
              const ab = await proxyResponse.arrayBuffer();
              responseBodyForClient = new Uint8Array(ab);
            }
          } catch {
            responseBodyForClient = null;
          }

          // If we got JSON and we have a taskRunId, try to detect completion
          if (taskRunId && parsedJson && !completedTasks.has(taskRunId)) {
            try {
              const completed = opencodeResponseIndicatesCompletion(parsedJson);
              if (completed) {
                completedTasks.add(taskRunId);
                const elapsedMs = Date.now() - start;
                emit("worker:task-complete", {
                  workerId,
                  taskRunId,
                  agentModel: "opencode",
                  elapsedMs,
                  detectionMethod: "opencode-proxy",
                });
              }
            } catch {
              // ignore detection error
            }
          }

          if (typeof responseBodyForClient === "string") {
            res.end(responseBodyForClient);
          } else if (responseBodyForClient) {
            res.end(Buffer.from(responseBodyForClient));
          } else {
            res.end();
          }
        } catch (e) {
          // Upstream failed; return 502
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({ error: "Bad Gateway to OpenCode upstream", details: String((e as Error)?.message || e) })
          );
        }
      });
    });

    server.listen(OPENCODE_PROXY_PORT);
  })().catch(() => {});

  return;
}

