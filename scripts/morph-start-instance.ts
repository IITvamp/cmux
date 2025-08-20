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
});

console.log(`Created instance: ${instance.id}`);

const exposedServices = instance.networking.httpServices;
const vscodeService = exposedServices.find((service) => service.port === 39378);
const workerService = exposedServices.find((service) => service.port === 39377);
if (!vscodeService || !workerService) {
  throw new Error("VSCode or worker service not found");
}

console.log(`VSCode: ${vscodeService.url}/?folder=/root/workspace`);

// connect to the worker management namespace with socketio
const clientSocket = io(workerService.url + "/management", {
  timeout: 10000,
  reconnectionAttempts: 3,
}) as Socket<WorkerToServerEvents, ServerToWorkerEvents>;

clientSocket.on("connect", () => {
  console.log("Connected to worker");
  // clientSocket.emit("get-active-terminals");
  // dispatch a tack
  clientSocket.emit(
    "worker:create-terminal",
    {
      terminalId: crypto.randomUUID(),
      cols: 80,
      rows: 24,
      cwd: "/root/workspace",
      command: "bun x opencode-ai 'whats the time'",
    },
    () => {
      console.log("Terminal created");
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
