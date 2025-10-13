import { RESERVED_CMUX_PORT_SET } from "@cmux/shared/utils/reserved-cmux-ports";

export interface DevServerCandidate {
  port: number;
  processName: string;
  cmdline?: string | null;
}

const COMMON_DEV_PORTS = new Set([
  80,
  3000,
  3001,
  3002,
  3003,
  3004,
  3010,
  3011,
  3030,
  3080,
  3100,
  3200,
  3300,
  3333,
  3400,
  3500,
  3600,
  3700,
  3800,
  3900,
  4000,
  4100,
  4200,
  4300,
  4400,
  4500,
  4600,
  4700,
  4800,
  4900,
  5000,
  5173,
  5174,
  5220,
  5432,
  5500,
  5555,
  5600,
  5678,
  6006,
  6060,
  6100,
  6200,
  6300,
  6400,
  6500,
  6600,
  6700,
  6800,
  6900,
  7000,
  7100,
  7200,
  7300,
  7400,
  7500,
  7600,
  7700,
  7800,
  7900,
  8000,
  8001,
  8002,
  8008,
  8010,
  8080,
  8081,
  8100,
  8200,
  8280,
  8282,
  8300,
  8443,
  8500,
  8600,
  8700,
  8800,
  8888,
  8900,
  9000,
  9001,
  9080,
  9100,
  9200,
  9300,
  9400,
  9500,
  9600,
  9700,
  9800,
  9900,
  9999,
]);

const COMMON_DEV_PORT_RANGES: ReadonlyArray<{ min: number; max: number }> = [
  { min: 3000, max: 3999 },
  { min: 4000, max: 4999 },
  { min: 5000, max: 5999 },
  { min: 6000, max: 6999 },
  { min: 7000, max: 7999 },
  { min: 8000, max: 8999 },
  { min: 9000, max: 9999 },
];

const IGNORED_PROCESS_NAMES = new Set([
  "chrome",
  "chromium",
  "cmux-cdp-proxy",
  "cmux-execd",
  "cmux-proxy",
  "containerd",
  "dockerd",
  "mainthread",
  "sshd",
  "systemd",
  "websockify",
  "x11vnc",
]);

const POSSIBLE_DEV_PROCESS_NAMES = new Set([
  "node",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "go",
  "python",
  "python3",
  "ruby",
  "php",
  "java",
  "uvicorn",
  "gunicorn",
  "flask",
  "django",
  "rails",
  "mix",
  "cargo",
  "dotnet",
  "meteor",
  "nr",
]);

const DEV_SERVER_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve|preview)\b/,
  /\bturbo\s+dev\b/,
  /\bnext\s+(dev|start)\b/,
  /\bnuxt\s+(dev|start)\b/,
  /\bastro\s+(dev|start|preview)\b/,
  /\bvite\b/,
  /\bsvelte(-kit)?\b.*\b(dev|preview|start)\b/,
  /\bremix\b.*\brun\b.*dev/,
  /\bwebpack(-dev-server|\s+serve)\b/,
  /\bstorybook\b.*\b(start|dev|storybook)\b/,
  /\bexpo\s+(start|r|run)\b/,
  /\bnx\s+(serve|run)\b/,
  /\bstrapi\s+develop\b/,
  /\bphp\s+-S\s+/,
  /\bpython\b.*\b(manage\.py\s+runserver|http\.server|uvicorn|flask\s+run|fastapi)\b/,
  /\buvicorn\b/,
  /\bgunicorn\b.*\b--reload\b/,
  /\bdjango-admin\b.*\brunserver\b/,
  /\brails\b.*\b(server|s)\b/,
  /\bmix\s+phx\.server\b/,
  /\bdeno\s+run\b.*\b--watch\b/,
  /\bgo\s+run\b/,
  /\bair\b/,
  /\bhugo\s+server\b/,
  /\beleventy\b.*\bserve\b/,
  /\bmkdocs\s+serve\b/,
  /\blive-server\b/,
  /\bbrowsersync\b/,
  /\bparcel\b.*\bserve\b/,
];

const MIN_COMMON_PORT = 1024;

export function isCommonDevPort(port: number): boolean {
  if (!Number.isFinite(port) || port <= 0) {
    return false;
  }
  if (COMMON_DEV_PORTS.has(port)) {
    return true;
  }
  return COMMON_DEV_PORT_RANGES.some(({ min, max }) => port >= min && port <= max);
}

export function matchesDevServerCommand(cmdline: string | null | undefined): boolean {
  if (!cmdline) {
    return false;
  }
  const normalized = cmdline.toLowerCase();
  return DEV_SERVER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isLikelyDevServerCandidate(candidate: DevServerCandidate): boolean {
  const { port, processName, cmdline } = candidate;

  if (!Number.isFinite(port) || port <= 0) {
    return false;
  }

  if (RESERVED_CMUX_PORT_SET.has(port)) {
    return false;
  }

  if (port < MIN_COMMON_PORT && !COMMON_DEV_PORTS.has(port)) {
    return false;
  }

  const normalizedProcess = processName.toLowerCase();
  if (IGNORED_PROCESS_NAMES.has(normalizedProcess)) {
    return false;
  }

  if (matchesDevServerCommand(cmdline)) {
    return true;
  }

  if (isCommonDevPort(port)) {
    if (POSSIBLE_DEV_PROCESS_NAMES.has(normalizedProcess)) {
      return true;
    }
  }

  return false;
}
