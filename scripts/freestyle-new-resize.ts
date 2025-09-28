import { client } from "./freestyle/freestyle-openapi-client/src/client/client.gen";

const FREESTYLE_API_KEY = process.env.FREESTYLE_API_KEY;
if (!FREESTYLE_API_KEY) {
  throw new Error("FREESTYLE_API_KEY is not set");
}

// Configure client with bearer auth and data-only responses
client.setConfig({
  headers: {
    Authorization: `Bearer ${FREESTYLE_API_KEY}`,
  },
  responseStyle: "data",
});

// Create a new VM, then resize it to 32GB (32768 MB)
const created = (await client.post({
  url: "/v1/vms",
  body: {
    idleTimeoutSeconds: 0,
    ports: [
      {
        port: 443,
        targetPort: 3000,
      },
    ],
    waitForReadySignal: true,
    readySignalTimeoutSeconds: 0,
    workdir: "/root",
    persistence: {
      priority: 5,
      type: "sticky",
    },
  },
})) as unknown as { id: string };

console.log("Created VM:", created);

const vmId: string = created.id;
const sizeMb: number = 32 * 1024; // 32768 MB

const resized = await client.post({
  url: "/v1/vms/{id}/resize",
  path: { id: vmId },
  body: { sizeMb },
  // responseStyle inherited from client config
});

console.log("Resize result:", resized);

export {};

