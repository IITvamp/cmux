import type { ServerToWorkerEvents, WorkerToServerEvents } from "@cmux/shared";
import { Socket } from "socket.io-client";

export async function workerExec({
  workerSocket,
  command,
  args,
  cwd,
  env,
  timeout = 60000,
}: {
  workerSocket: Socket<WorkerToServerEvents, ServerToWorkerEvents>;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeout?: number;
}) {
  return new Promise((resolve, reject) => {
    workerSocket
      .timeout(timeout)
      .emit("worker:exec", { command, args, cwd, env }, (error, payload) => {
        if (error) {
          reject(error);
          return;
        }
        if (payload.error) {
          reject(payload.error);
        } else {
          resolve(payload);
        }
      });
  });
}
