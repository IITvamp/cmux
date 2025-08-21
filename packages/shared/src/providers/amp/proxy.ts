import { createServer as createHttpServer } from "node:http";
import { readFile as fspReadFile } from "node:fs/promises";

export type AmpProxyOptions = {
  ampUrl?: string;
  logsDir?: string;
  workerId?: string;
  log?: (level: string, message: string, meta?: unknown, workerId?: string) => void;
  emitToMainServer?: (event: string, payload: unknown) => void;
};

export type AmpProxyHandle = void;

async function getRealAmpApiKey(): Promise<string | null> {
  try {
    const home = process.env.HOME || "/root";
    const secretsPath = `${home}/.local/share/amp/secrets.json`;
    const raw = await fspReadFile(secretsPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const key = (parsed["apiKey@https://ampcode.com/"] || parsed["apiKey@https://ampcode.com"] || "") as string;
    return key || null;
  } catch {
    return null;
  }
}

function extractTaskRunId(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) || undefined;
    const v = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(v)) return v[0];
    return v as string | undefined;
  };
  const auth = get("authorization") || get("Authorization");
  if (auth) {
    const token = auth.replace(/^[Bb]earer\s+/, "");
    // First, support explicit prefixes like taskRunId:<id>
    const m = token.match(/(?:taskRunId|taskrun|task|tr)[:=]([a-zA-Z0-9_-]+)/);
    if (m?.[1]) return m[1];
    // Otherwise, if the token itself looks like a plausible ID, accept it
    if (/^[a-zA-Z0-9_-]{16,64}$/.test(token)) {
      return token;
    }
  }
  return null;
}

function ampResponseIndicatesCompletion(json: unknown): boolean {
  if (json == null || typeof json !== "object") return false;
  const root = json as Record<string, unknown>;

  let messages: unknown = undefined;

  // Try obj.params.thread.messages
  const params = root["params"];
  if (params && typeof params === "object") {
    const threadFromParams = (params as Record<string, unknown>)["thread"];
    if (threadFromParams && typeof threadFromParams === "object") {
      const msgs = (threadFromParams as Record<string, unknown>)["messages"];
      if (Array.isArray(msgs)) {
        messages = msgs;
      }
    }
  }

  // Try obj.thread.messages
  if (!messages) {
    const thread = root["thread"];
    if (thread && typeof thread === "object") {
      const msgs = (thread as Record<string, unknown>)["messages"];
      if (Array.isArray(msgs)) {
        messages = msgs;
      }
    }
  }

  // Try obj.messages
  if (!messages) {
    const msgs = root["messages"];
    if (Array.isArray(msgs)) {
      messages = msgs;
    }
  }

  if (!Array.isArray(messages)) return false;

  for (const item of messages) {
    if (!item || typeof item !== "object") continue;
    const state = (item as Record<string, unknown>)["state"];
    if (!state || typeof state !== "object") continue;
    const typeVal = (state as Record<string, unknown>)["type"];
    if (typeof typeVal === "string") {
      const t = typeVal.toLowerCase();
      if (t === "completed" || t === "complete") return true;
    }
  }

  return false;
}

export function startAmpProxy(options: AmpProxyOptions = {}): AmpProxyHandle {
  const AMP_PROXY_PORT = 39379;
  const AMP_TARGET_HOST = options.ampUrl || process.env.AMP_URL || "https://ampcode.com";

  const emit = options.emitToMainServer || (() => {});
  const workerId = options.workerId;

  (async () => {

    const ampProxy = createHttpServer(async (req, res) => {
      const start = Date.now();
      const targetUrl = `${AMP_TARGET_HOST}${req.url || "/"}`;

      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

      req.on("end", async () => {
        const reqBuffer = Buffer.concat(chunks);
        const contentType = (req.headers["content-type"] || "") as string;

        // Clone headers for upstream, removing hop-by-hop headers
        const upstreamHeaders = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value == null) continue;
          if (key.toLowerCase() === "host") continue;
          if (key.toLowerCase() === "content-length") continue;
          if (Array.isArray(value)) {
            upstreamHeaders.set(key, value.join(", "));
          } else {
            upstreamHeaders.set(key, String(value));
          }
        }

        const taskRunId = extractTaskRunId(req.headers);

        // Replace Authorization with real AMP key
        const realKey = await getRealAmpApiKey();
        if (realKey) {
          upstreamHeaders.set("authorization", `Bearer ${realKey}`);
          upstreamHeaders.set("x-amp-api-key", realKey);
          upstreamHeaders.set("amp-api-key", realKey);
          upstreamHeaders.set("x-api-key", realKey);
        }

        // Use Uint8Array for Node/Web fetch compatibility; Buffer extends Uint8Array
        let bodyForFetch: string | Uint8Array | undefined = undefined;
        let loggedRequestBody: unknown = undefined;
        if (req.method && req.method !== "GET" && req.method !== "HEAD") {
          if (typeof contentType === "string" && contentType.includes("application/json")) {
            const text = reqBuffer.toString("utf8");
            bodyForFetch = text;
          } else {
            bodyForFetch = reqBuffer;
            loggedRequestBody = contentType && String(contentType).includes("multipart/form-data")
              ? "[multipart/form-data]"
              : (reqBuffer.length > 0 ? reqBuffer.toString("utf8") : "");
          }
        }

        const proxyResponse = await fetch(targetUrl, {
          method: req.method,
          headers: upstreamHeaders,
          body: bodyForFetch,
          redirect: "manual",
        });

        const responseHeaders = new Headers(proxyResponse.headers);
        responseHeaders.delete("content-encoding");
        responseHeaders.delete("content-length");
        

        const completed = ampResponseIndicatesCompletion(loggedRequestBody);
        if (completed && taskRunId) {
          const elapsedMs = Date.now() - start;
          emit("worker:task-complete", {
            workerId,
            taskRunId,
            agentModel: "amp",
            elapsedMs,
          });
        }

        res.statusCode = proxyResponse.status;
        res.statusMessage = proxyResponse.statusText;
        responseHeaders.forEach((v, k) => res.setHeader(k, v));
        res.end(await proxyResponse.arrayBuffer());
      });
    });

    ampProxy.listen(AMP_PROXY_PORT, () => {});
  })();

  return;
}
