import type { ServerToWorkerEvents, WorkerToServerEvents } from "@cmux/shared";
import { Socket } from "socket.io-client";

export async function workerExec({
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
