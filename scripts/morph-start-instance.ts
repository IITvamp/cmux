// const instance = await client.instances.start({ snapshotId: "snapshot_lsaf582l" });

import type { ServerToWorkerEvents, WorkerToServerEvents } from "@cmux/shared";
import { MorphCloudClient } from "morphcloud";
import { io, Socket } from "socket.io-client";

const client = new MorphCloudClient();

console.log("Starting instance");
const instance = await client.instances.start({
  // snapshotId: "snapshot_yawsf9cr",
  // snapshotId: "snapshot_kco1jqb6",
  snapshotId: "snapshot_5h9hvkqq",
  // 30 minutes
  ttlSeconds: 60 * 30,
  ttlAction: "pause",
  metadata: {
    app: "cmux-dev",
  },
});

process.on("SIGINT", async () => {
  console.log("Stopping instance");
  await instance.stop();
  process.exit(0);
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

clientSocket.on("disconnect", () => {
  console.log("Disconnected from worker");
  process.exit(1);
});
await new Promise((resolve, reject) => {
  clientSocket.on("connect_error", (err) => {
    console.error("Failed to connect to worker", err);
    reject(err);
  });

  clientSocket.on("connect", () => {
    console.log("Connected to worker!");
    resolve(true);
  });
});

async function workerExec({
  workerSocket,
  command,
  args,
  cwd,
  env,
}: {
  workerSocket: Socket<WorkerToServerEvents, ServerToWorkerEvents>;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}) {
  return new Promise((resolve, reject) => {
    workerSocket.emit("worker:exec", { command, args, cwd, env }, (payload) => {
      if (payload.error) {
        reject(payload.error);
      } else {
        resolve(payload);
      }
    });
  });
}

await workerExec({
  workerSocket: clientSocket,
  command: "git",
  args: [
    "clone",
    "--depth=1",
    "https://github.com/manaflow-ai/cmux",
    "/root/workspace",
  ],
  cwd: "/root",
  env: {},
});

// then start tmux

await workerExec({
  workerSocket: clientSocket,
  command: "tmux",
  args: ["new-session", "-s", "cmux", "-d"],
  cwd: "/root/workspace",
  env: {},
});

// then we

console.log("Press Ctrl+C to stop instance");
await new Promise(() => void {});
