import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@coderouter/shared";
import { Daytona } from "@daytonaio/sdk";
import { io, Socket } from "socket.io-client";

const daytona = new Daytona();

console.log("Creating sandbox...");
const sandbox = await daytona.create(
  {
    image: "coderouter-worker:0.0.1",
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

const [{ url: vscodeUrl }, { url: workerUrl }] =
  await Promise.all([
    sandbox.getPreviewLink(2376),
    sandbox.getPreviewLink(2377),
  ]);

console.log({ vscodeUrl, workerUrl });

const workerSocket = io(workerUrl + '/client') as Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;
console.log("Connected to worker");
console.log(workerSocket);
