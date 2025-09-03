export type EnvKey = string;

export type EventKind = "set" | "unset";

export type ChangeEvent = {
  gen: number;
  kind: EventKind;
  key: EnvKey;
  value?: string;
};

export type Request =
  | { cmd: "ping" }
  | { cmd: "status" }
  | { cmd: "get"; key: EnvKey }
  | { cmd: "list" }
  | { cmd: "set"; key: EnvKey; value: string }
  | { cmd: "unset"; key: EnvKey }
  | { cmd: "load"; entries: Record<string, string> }
  | { cmd: "export"; shell: "bash" | "zsh" | "fish"; since?: number };

export type Response =
  | { ok: true; pong: true }
  | { ok: true; status: { gen: number; count: number } }
  | { ok: true; value?: string }
  | { ok: true; entries: Record<string, string>; gen: number }
  | { ok: true; gen: number }
  | { ok: true; script: string; gen: number }
  | { ok: false; error: string };

export function isValidKey(key: string): boolean {
  // POSIX-ish env var names
  return /^[A-Z_][A-Z0-9_]*$/.test(key);
}

export function shellEscapeSingle(value: string): string {
  // Wrap in single quotes and escape any single quotes inside
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function renderExport(
  shell: "bash" | "zsh" | "fish",
  changes: ChangeEvent[],
): string {
  const lines: string[] = [];
  for (const ch of changes) {
    if (ch.kind === "unset") {
      if (shell === "fish") {
        lines.push(`set -e ${ch.key}`);
      } else {
        lines.push(`unset ${ch.key}`);
      }
    } else if (ch.kind === "set") {
      const v = shellEscapeSingle(ch.value ?? "");
      if (shell === "fish") {
        lines.push(`set -x ${ch.key} ${v}`);
      } else {
        lines.push(`export ${ch.key}=${v}`);
      }
    }
  }
  return lines.join("\n");
}

