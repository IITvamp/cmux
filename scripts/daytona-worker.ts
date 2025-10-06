import type { ClientToServerEvents, ServerToClientEvents } from "@cmux/shared";
import { Daytona } from "@daytonaio/sdk";
import { io, Socket } from "socket.io-client";

const daytona = new Daytona();

console.log("Creating sandbox...");
const sandbox = await daytona.create(
  {
    image: "cmux-worker:0.0.1",
    public: true,
  },
  {
    timeout: 10000,
  }
);

console.log("Sandbox created");

async function runCommand(command: string) {
  const response = await sandbox.process.executeCommand(command);
  console.log(response.result);
  return response.result;
}

await runCommand("docker --version");

const [{ url: vscodeUrl }, { url: workerUrl }, { url: vncUrl }] =
  await Promise.all([
    sandbox.getPreviewLink(39378),
    sandbox.getPreviewLink(39377),
    sandbox.getPreviewLink(39380),
  ]);

console.log({ vscodeUrl, workerUrl, vncUrl });

const workerSocket = io(workerUrl + "/client") as Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;
console.log("Connected to worker");
console.log(workerSocket);
