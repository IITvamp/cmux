const FREESTYLE_API_KEY = process.env.FREESTYLE_API_KEY;
if (!FREESTYLE_API_KEY) {
  throw new Error("FREESTYLE_API_KEY is not set");
}

async function stop({ vmId }: { vmId: string }) {
  const result = await fetch(`https://api.freestyle.sh/v1/vms/${vmId}/stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FREESTYLE_API_KEY}`,
    },
  });

  if (!result.ok) {
    throw new Error(`Fork failed: ${result.status} ${result.statusText}`);
  }

  return await result.json();
}

async function fork({ vmId }: { vmId: string }) {
  const result = await fetch(`https://api.freestyle.sh/v1/vms/${vmId}/fork`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FREESTYLE_API_KEY}`,
    },
    body: JSON.stringify({
      idleTimeoutSeconds: null,
      ports: [
        {
          port: 443,
          targetPort: 3000,
        },
      ],
      // readySignalTimeoutSeconds: true,
      waitForReadySignal: null,
      workdir: "/root",
      persistence: {
        priority: 5,
        type: "sticky",
      },
    }),
  });

  if (!result.ok) {
    throw new Error(`Fork failed: ${result.status} ${result.statusText}`);
  }

  return await result.json();
}

const vmId = "bqavy";

console.time("Fork 0");
const forkResult = await fork({ vmId });
console.timeEnd("Fork 0");
console.log("Fork created:", forkResult);

// then stop it

console.time("Stop");
const suspendResult = await stop({ vmId: forkResult.id });
console.timeEnd("Stop");
console.log("Stop result:", suspendResult);

// then fork it again

console.time("Fork 1");
const forkResult1 = await fork({ vmId: forkResult.id });
console.timeEnd("Fork 1");
console.log("Fork created:", forkResult1);

export {};
