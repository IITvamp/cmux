import type { RealtimeServer } from "../realtime.js";
import { serverLogger } from "./fileLogger.js";
import { checkAllProvidersStatus } from "./providerStatus.js";
import * as fs from "node:fs";
import * as path from "node:path";
import Docker from "dockerode";

type WatchState = {
  isRunning: boolean | null; // null = unknown
  initialized: boolean;
  debounceTimer?: NodeJS.Timeout;
  backoffMs: number;
  watcher?: fs.FSWatcher;
  eventsStream?: NodeJS.ReadableStream | null;
};

const DEFAULT_UNIX_SOCKET = "/var/run/docker.sock";
const MAX_BACKOFF_MS = 60_000;

let state: WatchState = {
  isRunning: null,
  initialized: false,
  backoffMs: 1_000,
  eventsStream: null,
};

function getDockerHost(): { type: "unix" | "npipe" | "tcp"; address: string } {
  const h = process.env.DOCKER_HOST?.trim();
  if (!h || h === "unix:///var/run/docker.sock") {
    return { type: "unix", address: DEFAULT_UNIX_SOCKET };
  }
  if (h.startsWith("unix://")) {
    return { type: "unix", address: h.replace(/^unix:\/\//, "") };
  }
  if (h.startsWith("npipe://")) {
    return { type: "npipe", address: h };
  }
  return { type: "tcp", address: h };
}

function getDockerClient(): Docker {
  const host = getDockerHost();
  if (host.type === "unix") {
    return new Docker({ socketPath: host.address });
  }
  if (host.type === "npipe") {
    // dockerode handles npipe via host/port; rely on env vars
    return new Docker();
  }
  // tcp or other — rely on env vars
  return new Docker();
}

async function broadcastStatus(rt: RealtimeServer) {
  try {
    const status = await checkAllProvidersStatus();
    rt.emit("provider-status-updated", { success: true, ...status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    serverLogger.error("[DockerWatcher] Failed to compute provider status:", msg);
    rt.emit("provider-status-updated", { success: false, error: msg });
  }
}

function setStateAndBroadcast(rt: RealtimeServer, running: boolean) {
  if (state.isRunning === running) return;
  state.isRunning = running;
  serverLogger.info(`Docker readiness changed: ${running ? "running" : "down"}`);
  // Reset backoff on transitions
  state.backoffMs = 1_000;
  void broadcastStatus(rt);
}

function scheduleCheck(rt: RealtimeServer, delayMs = 250) {
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(async () => {
    try {
      const docker = getDockerClient();
      // A lightweight readiness check; do not poll constantly.
      await docker.ping();
      setStateAndBroadcast(rt, true);
      ensureEventsStream(rt, docker);
    } catch {
      setStateAndBroadcast(rt, false);
      scheduleBackoff(rt);
    }
  }, delayMs);
}

function scheduleBackoff(rt: RealtimeServer) {
  const wait = Math.min(state.backoffMs, MAX_BACKOFF_MS);
  state.backoffMs = Math.min(wait * 2, MAX_BACKOFF_MS);
  serverLogger.info(`[DockerWatcher] Will retry readiness check in ${wait}ms`);
  setTimeout(() => scheduleCheck(rt, 0), wait);
}

function ensureEventsStream(rt: RealtimeServer, docker?: Docker) {
  if (state.eventsStream) return;
  const d = docker ?? getDockerClient();
  try {
    d.getEvents({}, (err, stream) => {
      if (err || !stream) {
        serverLogger.warn(
          "[DockerWatcher] Failed to attach events stream, scheduling backoff",
          err
        );
        state.eventsStream = null;
        scheduleBackoff(rt);
        return;
      }

      state.eventsStream = stream;
      serverLogger.info("[DockerWatcher] Attached to Docker events stream");
      // If we reach here, daemon is up
      setStateAndBroadcast(rt, true);

      stream.on("close", () => {
        serverLogger.warn(
          "[DockerWatcher] Docker events stream closed; marking as down and retrying"
        );
        state.eventsStream = null;
        setStateAndBroadcast(rt, false);
        scheduleBackoff(rt);
      });
      stream.on("error", (e) => {
        serverLogger.warn("[DockerWatcher] Docker events stream error:", e);
        state.eventsStream = null;
        setStateAndBroadcast(rt, false);
        scheduleBackoff(rt);
      });
    });
  } catch (e) {
    serverLogger.warn("[DockerWatcher] Error creating events stream:", e);
    state.eventsStream = null;
    scheduleBackoff(rt);
  }
}

function startFsWatcher(rt: RealtimeServer) {
  try {
    const host = getDockerHost();
    if (host.type !== "unix") {
      serverLogger.info(
        `[DockerWatcher] Non-unix DOCKER_HOST detected (${host.address}); using backoff checks only`
      );
      scheduleCheck(rt, 0);
      return;
    }

    const socketPath = host.address || DEFAULT_UNIX_SOCKET;
    const dir = path.dirname(socketPath);
    const file = path.basename(socketPath);

    // Watch for docker.sock creation/replace events without polling
    state.watcher?.close();
    state.watcher = fs.watch(dir, (eventType, filename) => {
      if (!filename) return;
      if (filename.toString() !== file) return;
      // rename events usually indicate socket recreated on daemon restart
      if (eventType === "rename" || eventType === "change") {
        serverLogger.info(`[DockerWatcher] Detected change for ${file} (${eventType})`);
        scheduleCheck(rt, 200);
      }
    });
    serverLogger.info(`[DockerWatcher] Watching ${dir} for ${file} changes`);

    // Trigger initial check based on current existence
    scheduleCheck(rt, 0);
  } catch (e) {
    serverLogger.error("[DockerWatcher] Failed to start fs watcher:", e);
    scheduleCheck(rt, 0);
  }
}

export function startDockerReadinessWatcher(rt: RealtimeServer) {
  if (state.initialized) return;
  state.initialized = true;
  serverLogger.info("[DockerWatcher] Initializing Docker readiness watcher");
  startFsWatcher(rt);
}

