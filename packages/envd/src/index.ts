#!/usr/bin/env bun
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, Socket } from "node:net";
import { EOL } from "node:os";
import { dirname, join } from "node:path";
import readline from "node:readline";
import type { ChangeEvent, Request as RpcRequest, Response as RpcResponse } from "./protocol.js";
import { isValidKey, renderExport } from "./protocol.js";

type State = {
  gen: number;
  map: Map<string, string>;
  history: ChangeEvent[];
};

function getRuntimeDir(): string {
  const xdg = process.env["XDG_RUNTIME_DIR"];
  if (xdg && xdg.length > 0) return xdg;
  return "/tmp";
}

function getSocketPath(): string {
  const dir = join(getRuntimeDir(), "cmux-envd");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
  return join(dir, "envd.sock");
}

function ok(res: Omit<Extract<RpcResponse, { ok: true }>, "ok">): RpcResponse {
  return { ok: true, ...res } as RpcResponse;
}

function err(error: string): RpcResponse {
  return { ok: false, error };
}

function safeParse(line: string): RpcRequest | null {
  try {
    return JSON.parse(line) as RpcRequest;
  } catch {
    return null;
  }
}

function handle(state: State, req: RpcRequest): RpcResponse {
  switch (req.cmd) {
    case "ping":
      return ok({ pong: true });
    case "status":
      return ok({ status: { gen: state.gen, count: state.map.size } });
    case "get": {
      const v = state.map.get(req.key);
      return ok({ value: v });
    }
    case "list": {
      const entries: Record<string, string> = {};
      for (const [k, v] of state.map.entries()) entries[k] = v;
      return ok({ entries, gen: state.gen });
    }
    case "set": {
      if (!isValidKey(req.key)) return err(`invalid key: ${req.key}`);
      state.map.set(req.key, req.value);
      state.gen++;
      state.history.push({ gen: state.gen, kind: "set", key: req.key, value: req.value });
      return ok({ gen: state.gen });
    }
    case "unset": {
      if (!isValidKey(req.key)) return err(`invalid key: ${req.key}`);
      state.map.delete(req.key);
      state.gen++;
      state.history.push({ gen: state.gen, kind: "unset", key: req.key });
      return ok({ gen: state.gen });
    }
    case "load": {
      // replace or merge? We'll merge: load entries and overwrite keys provided.
      for (const [k, v] of Object.entries(req.entries)) {
        if (!isValidKey(k)) continue;
        state.map.set(k, v);
        state.gen++;
        state.history.push({ gen: state.gen, kind: "set", key: k, value: v });
      }
      return ok({ gen: state.gen });
    }
    case "export": {
      const since = typeof req.since === "number" ? req.since : 0;
      const changes = state.history.filter((h) => h.gen > since);
      const script = renderExport(req.shell, changes);
      return ok({ script, gen: state.gen });
    }
    default:
      return err("unknown command");
  }
}

function startServer(sockPath: string): void {
  if (existsSync(sockPath)) {
    try {
      rmSync(sockPath);
    } catch (e) {
      void e; // ignore; if remove fails, server creation will also fail
    }
  }

  const state: State = { gen: 0, map: new Map(), history: [] };

  const server = createServer((socket: Socket) => {
    const rl = readline.createInterface({ input: socket });
    rl.on("line", (line) => {
      const req = safeParse(line);
      const res = req ? handle(state, req) : err("invalid json");
      socket.write(JSON.stringify(res) + "\n");
    });
    rl.on("close", () => socket.end());
  });

  server.on("listening", () => {
    // Write a pid file for ergonomics
    try {
      const pidFile = join(dirname(sockPath), "envd.pid");
      writeFileSync(pidFile, String(process.pid));
    } catch (e) { void e }
    console.log(`[envd] listening on ${sockPath}`);
  });

  server.on("error", (e) => {
    console.error("[envd] server error:", e);
    process.exit(1);
  });

  server.listen(sockPath);

  const cleanup = () => {
    try {
      server.close();
    } catch (e) { void e }
    try {
      if (existsSync(sockPath)) rmSync(sockPath);
    } catch (e) { void e }
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);
}

function main() {
  const args = process.argv.slice(2);
  const sock = getSocketPath();
  if (args.includes("--print-socket")) {
    console.log(sock);
    return;
  }
  if (args.includes("start") || args.length === 0) {
    startServer(sock);
    return;
  }
  if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    console.log(
      [
        "Usage: envd [start] [--print-socket]",
        "",
        "Starts the per-user env daemon listening on a Unix socket.",
        `Socket: ${sock}`,
      ].join(EOL),
    );
    return;
  }
  console.error("unknown args", args.join(" "));
  process.exit(2);
}

main();
