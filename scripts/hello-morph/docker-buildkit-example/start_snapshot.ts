import type {
  ServerToWorkerEvents,
  WorkerToServerEvents,
} from "@coderouter/shared";
import { MorphCloudClient } from "morphcloud";
import { io, Socket } from "socket.io-client";

const client = new MorphCloudClient();
const instance = await client.instances.start({
  snapshotId: "snapshot_gn1wmycs",
});

console.log(`Created instance: ${instance.id}`);

const exposedServices = instance.networking.httpServices;
const vscodeService = exposedServices.find((service) => service.port === 2376);
const workerService = exposedServices.find((service) => service.port === 3002);
if (!vscodeService || !workerService) {
  throw new Error("VSCode or worker service not found");
}

console.log(`VSCode: ${vscodeService.url}/?folder=/root/workspace`);

// connect to the worker with socketio
const clientSocket = io(workerService.url, {
  timeout: 10000,
  reconnectionAttempts: 3,
}) as Socket<WorkerToServerEvents, ServerToWorkerEvents>;

clientSocket.on("connect", () => {
  console.log("Connected to worker");
  // clientSocket.emit("get-active-terminals");
  // dispatch a tack
  clientSocket.emit("worker:create-terminal", {
    terminalId: crypto.randomUUID(),
    cols: 80,
    rows: 24,
    cwd: "/root/workspace",
    command: "bun x opencode-ai 'whats the time'",
  });
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
