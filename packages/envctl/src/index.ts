#!/usr/bin/env bun
import { createConnection } from "node:net";
import { EOL } from "node:os";
import { basename, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

type RpcRequest =
  | { cmd: "ping" }
  | { cmd: "status" }
  | { cmd: "get"; key: string }
  | { cmd: "list" }
  | { cmd: "set"; key: string; value: string }
  | { cmd: "unset"; key: string }
  | { cmd: "load"; entries: Record<string, string> }
  | { cmd: "export"; shell: "bash" | "zsh" | "fish"; since?: number };

type RpcResponse =
  | { ok: true; pong: true }
  | { ok: true; status: { gen: number; count: number } }
  | { ok: true; value?: string }
  | { ok: true; entries: Record<string, string>; gen: number }
  | { ok: true; gen: number }
  | { ok: true; script: string; gen: number }
  | { ok: false; error: string };

function getRuntimeDir(): string {
  const xdg = process.env["XDG_RUNTIME_DIR"];
  if (xdg && xdg.length > 0) return xdg;
  return "/tmp";
}

function getSocketPath(): string {
  return join(getRuntimeDir(), "cmux-envd", "envd.sock");
}

function isValidKey(key: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(key);
}

function request<T extends RpcResponse = RpcResponse>(req: RpcRequest): Promise<T> {
  const sockPath = getSocketPath();
  return new Promise((resolve, reject) => {
    const s = createConnection(sockPath);
    let buf = "";
    const finish = (line: string) => {
      try {
        const obj = JSON.parse(line) as T;
        resolve(obj);
      } catch (e) {
        reject(e);
      } finally {
        try { s.destroy(); } catch (err) { void err; }
      }
    };
    s.on("connect", () => {
      s.write(JSON.stringify(req) + "\n");
    });
    s.on("data", (d) => {
      buf += String(d);
      const idx = buf.indexOf("\n");
      if (idx !== -1) {
        const line = buf.slice(0, idx);
        finish(line);
      }
    });
    s.on("error", (e) => reject(e));
  });
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7) : line;
    const eq = withoutExport.indexOf("=");
    if (eq === -1) continue;
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1);
    if (!isValidKey(key)) continue;
    // Remove optional surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function printHelp(): void {
  const prog = basename(process.argv[1] || "envctl");
  console.log(
    [
      `Usage: ${prog} <command> [args]`,
      "",
      "Commands:",
      "  set KEY=VAL            Set a variable",
      "  unset KEY              Unset a variable",
      "  get KEY                Get a variable",
      "  list                   List all variables",
      "  load [FILE|-]         Load .env from file or stdin",
      "  export <bash|zsh|fish> [--since GEN]",
      "                         Print export/unset script diff and bump gen",
      "  hook <bash|zsh|fish>   Print shell hook code",
      "  status                 Show daemon status",
      "  ping                   Ping daemon",
    ].join(EOL),
  );
}

async function cmdSet(arg: string): Promise<void> {
  const eq = arg.indexOf("=");
  if (eq === -1) throw new Error("set requires KEY=VALUE");
  const key = arg.slice(0, eq);
  const value = arg.slice(eq + 1);
  const res = await request({ cmd: "set", key, value });
  if (!res.ok) throw new Error(res.error);
}

async function cmdUnset(key: string): Promise<void> {
  const res = await request({ cmd: "unset", key });
  if (!res.ok) throw new Error(res.error);
}

async function cmdGet(key: string): Promise<void> {
  const res = await request<{ ok: true; value?: string }>({ cmd: "get", key });
  if (res.value != null) console.log(res.value);
}

async function cmdList(): Promise<void> {
  const res = await request<{ ok: true; entries: Record<string, string>; gen: number }>({ cmd: "list" });
  for (const [k, v] of Object.entries(res.entries)) {
    console.log(`${k}=${v}`);
  }
}

async function cmdLoad(file?: string): Promise<void> {
  let content = "";
  if (!file || file === "-") {
    content = await new Promise<string>((resolve, reject) => {
      let acc = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        acc += String(chunk);
      });
      process.stdin.on("end", () => resolve(acc));
      process.stdin.on("error", (e) => reject(e));
    });
  } else {
    if (!existsSync(file)) throw new Error(`file not found: ${file}`);
    content = readFileSync(file, "utf8");
  }
  const entries = parseEnvFile(content);
  const res = await request({ cmd: "load", entries });
  if (!res.ok) throw new Error(res.error);
}

async function cmdExport(shell: "bash" | "zsh" | "fish", since?: number): Promise<void> {
  const res = await request<{ ok: true; script: string; gen: number }>({ cmd: "export", shell, since });
  const gen = res.gen;
  const lines: string[] = [];
  if (res.script) lines.push(res.script);
  if (shell === "fish") {
    lines.push(`set -x __ENVCTL_GEN ${gen}`);
  } else {
    lines.push(`export __ENVCTL_GEN='${gen}'`);
  }
  console.log(lines.filter(Boolean).join("\n"));
}

function hookBash(): string {
  return [
    "# envctl bash hook",
    "__envctl_refresh() {",
    "  local gen=\"${__ENVCTL_GEN:-0}\"",
    "  local script;",
    "  script=$(envctl export bash --since \"$gen\") || return;",
    "  eval \"$script\";",
    "}",
    "PROMPT_COMMAND=__envctl_refresh${PROMPT_COMMAND:+;$PROMPT_COMMAND}",
    "trap '__envctl_refresh' DEBUG",
  ].join("\n");
}

function hookZsh(): string {
  return [
    "# envctl zsh hook",
    "function __envctl_refresh() {",
    "  local gen=\"${__ENVCTL_GEN:-0}\"",
    "  local script;",
    "  script=$(envctl export zsh --since \"$gen\") || return",
    "  eval \"$script\"",
    "}",
    "autoload -Uz add-zsh-hook",
    "add-zsh-hook precmd __envctl_refresh",
    "preexec_functions+=(__envctl_refresh)",
  ].join("\n");
}

function hookFish(): string {
  return [
    "# envctl fish hook",
    "function __envctl_refresh --on-event fish_prompt",
    "  set -l gen (string escape -- $__ENVCTL_GEN)",
    "  set -l script (envctl export fish --since $gen)",
    "  eval $script",
    "end",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    return;
  }

  try {
    switch (args[0]) {
      case "ping": {
        const res = await request<{ ok: true; pong: true }>({ cmd: "ping" });
        if (res.ok && res.pong) console.log("pong");
        break;
      }
      case "status": {
        const res = await request<{ ok: true; status: { gen: number; count: number } }>({ cmd: "status" });
        console.log(`gen=${res.status.gen} count=${res.status.count}`);
        break;
      }
      case "set": {
        if (!args[1]) throw new Error("set requires KEY=VALUE");
        await cmdSet(args[1]);
        break;
      }
      case "unset": {
        if (!args[1]) throw new Error("unset requires KEY");
        await cmdUnset(args[1]);
        break;
      }
      case "get": {
        if (!args[1]) throw new Error("get requires KEY");
        await cmdGet(args[1]);
        break;
      }
      case "list": {
        await cmdList();
        break;
      }
      case "load": {
        await cmdLoad(args[1]);
        break;
      }
      case "export": {
        const shell = (args[1] as "bash" | "zsh" | "fish") || "bash";
        let since: number | undefined;
        const idx = args.indexOf("--since");
        if (idx !== -1 && args[idx + 1]) since = Number(args[idx + 1]);
        await cmdExport(shell, since);
        break;
      }
      case "hook": {
        const shell = (args[1] as "bash" | "zsh" | "fish") || "bash";
        if (shell === "bash") console.log(hookBash());
        else if (shell === "zsh") console.log(hookZsh());
        else if (shell === "fish") console.log(hookFish());
        else throw new Error("unknown shell");
        break;
      }
      default:
        printHelp();
        process.exit(2);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    process.exit(1);
  }
}

main();
