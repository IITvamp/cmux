// const instance = await client.instances.start({ snapshotId: "snapshot_lsaf582l" });

import type { ServerToWorkerEvents, WorkerToServerEvents } from "@cmux/shared";
import { MorphCloudClient } from "morphcloud";
import { io, Socket } from "socket.io-client";

const client = new MorphCloudClient();
const instance = await client.instances.start({
  // snapshotId: "snapshot_yawsf9cr",
  snapshotId: "snapshot_kco1jqb6",
  // 30 minutes
  ttlSeconds: 60 * 30,
  ttlAction: "pause",
  metadata: {
    app: "cmux-dev",
  },
});

console.log(`Created instance: ${instance.id}`);

const exposedServices = instance.networking.httpServices;
const vscodeService = exposedServices.find((service) => service.port === 39378);
const workerService = exposedServices.find((service) => service.port === 39377);
if (!vscodeService || !workerService) {
  throw new Error("VSCode or worker service not found");
}

console.log(`VSCode: ${vscodeService.url}/?folder=/root/workspace`);

console.log("Connecting to worker...");

console.log("workerService.url", workerService.url);

const workerUrl = new URL(workerService.url);
workerUrl.pathname = "/management";

console.log("workerUrl", workerUrl.toString());

// connect to the worker management namespace with socketio
const clientSocket = io(workerUrl.toString(), {
  timeout: 10000,
  reconnectionAttempts: 3,
  autoConnect: true,
  transports: ["websocket"],
  forceNew: true,
}) as Socket<WorkerToServerEvents, ServerToWorkerEvents>;

clientSocket.on("connect_error", (err) => {
  console.error("Failed to connect to worker", err);
});

clientSocket.on("connect", () => {
  console.log("Connected to worker!");
  // clientSocket.emit("get-active-terminals");
  // dispatch a tack
  clientSocket.emit(
    "worker:exec",
    {
      command: "tmux",
      args: ["new-session", "-s", "ski", "-d"],
      cwd: "/root/workspace",
      env: {},
      // terminalId: crypto.randomUUID(),
      // cols: 80,
      // rows: 24,
      // cwd: "/root/workspace",
      // command: "bun x opencode-ai 'whats the time'",
    },
    (payload) => {
      console.log("worker:exec result", payload);
    }
  );
});

clientSocket.on("disconnect", () => {
  console.log("Disconnected from worker");
});

process.on("SIGINT", async () => {
  console.log("Stopping instance");
  await instance.stop();
  process.exit(0);
});

console.log("Press Ctrl+C to stop instance");
await new Promise(() => void {});
