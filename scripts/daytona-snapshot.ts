import { Daytona, Image } from "@daytonaio/sdk";
import { io } from "socket.io-client";

try {
  const daytona = new Daytona();

  // fake the cwd to be worker dir
  // process.chdir(path.join(import.meta.dirname, ".."));

  // const image = Image.fromDockerfile("Dockerfile");
  const image = Image.base("docker:28.3.2-dind")
    .runCommands(
      "apk add --no-cache curl python3 make g++ linux-headers bash nodejs npm"
    )
    .runCommands("which npm && npm --version")
    .runCommands("curl -fsSL https://bun.sh/install | bash")
    .addLocalDir("apps/worker", "/coderouter/apps/worker")
    .addLocalDir("packages/shared", "/coderouter/packages/shared")
    .addLocalFile("package.json", "/coderouter/package.json")
    .runCommands("npm install")
    .env({
      PATH: "/root/.bun/bin:$PATH",
    })
    .runCommands("mkdir -p /builtins")
    .runCommands(
      "bun build /coderouter/apps/worker/src/index.ts --target node --outdir /builtins/build"
    )
    .runCommands("cp -r /coderouter/apps/worker/build /builtins/build")
    .addLocalFile(
      "apps/worker/wait-for-docker.sh",
      "/usr/local/bin/wait-for-docker.sh"
    )
    .addLocalFile("apps/worker/start-up.sh", "/usr/local/bin/startup.sh")
    .runCommands("mkdir -p /workspace")
    .env({
      NODE_ENV: "production",
      WORKER_PORT: "3002",
      MANAGEMENT_PORT: "3003",
    })
    .entrypoint(["/startup.sh"]);

  console.log("skibidi");
  const fk = await daytona.snapshot.create(
    {
      name: `coderouter-worker-${Date.now()}`,
      image,
    },
    { onLogs: console.log, timeout: 10000 }
  );
  console.log("snapshot created", fk);

  const sandbox = await daytona.create(
    {
      image,
      public: true,
    },
    {
      onSnapshotCreateLogs: console.log,
      timeout: 10000,
    }
  );

  async function runCommand(command: string) {
    const response = await sandbox.process.executeCommand(command);
    console.log(response.result);
    return response.result;
  }

  // Wait for Docker to fully initialize
  console.log("Waiting for Docker daemon to initialize...");
  const now = Date.now();
  await runCommand("wait-for-docker.sh");
  console.log(`Docker daemon is ready after ${Date.now() - now}ms`);

  // Test Docker functionality
  await runCommand("docker --version");
  await runCommand("docker-compose --version");

  // Verify devcontainer CLI is installed
  await runCommand("devcontainer --version");

  const { url } = await sandbox.getPreviewLink(3003);

  const managementSocket = io(url);

  managementSocket.on("connect", () => {
    console.log("Connected to worker management port");
  });

  managementSocket.on("worker:register", (data) => {
    console.log("Worker registered:", data);

    // Test creating a terminal
    managementSocket.emit("worker:create-terminal", {
      terminalId: "test-terminal-1",
      cols: 80,
      rows: 24,
      cwd: "/",
    });
  });

  managementSocket.on("worker:terminal-created", (data) => {
    console.log("Terminal created:", data);

    // Test sending input
    managementSocket.emit("worker:terminal-input", {
      terminalId: "test-terminal-1",
      data: 'echo "Hello from worker!"\r',
    });
  });

  managementSocket.on("worker:terminal-output", (data) => {
    console.log("Terminal output:", data);

    // Exit after seeing output
    if (data.data.includes("Hello from worker!")) {
      console.log("Test successful!");
      setTimeout(() => {
        managementSocket.disconnect();
        clientSocket.disconnect();
        process.exit(0);
      }, 1000);
    }
  });

  managementSocket.on("worker:heartbeat", (data) => {
    console.log("Worker heartbeat:", data);
  });

  managementSocket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  // Also test client connection
  const clientSocket = io("http://localhost:3002");

  clientSocket.on("connect", () => {
    console.log("Connected to worker client port");
  });

  clientSocket.on("terminal-created", (data) => {
    console.log("Client: Terminal created:", data);
  });

  clientSocket.on("terminal-output", (data) => {
    console.log("Client: Terminal output:", data.data);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("Shutting down test client...");
    managementSocket.disconnect();
    clientSocket.disconnect();
    process.exit(0);
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
