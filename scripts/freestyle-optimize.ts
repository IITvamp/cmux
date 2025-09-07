const FREESTYLE_API_KEY = process.env.FREESTYLE_API_KEY;
if (!FREESTYLE_API_KEY) {
  throw new Error("FREESTYLE_API_KEY is not set");
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

async function optimize({ vmId }: { vmId: string }) {
  console.log("Optimizing VM:", vmId);
  const result = await fetch(
    `https://api.freestyle.sh/v1/vms/${vmId}/optimize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FREESTYLE_API_KEY}`,
      },
      // body: JSON.stringify({}),
    }
  );

  if (!result.ok) {
    throw new Error(`Fork failed: ${result.status} ${result.statusText}`);
  }

  return await result.json();
}

const vmId = "bqavy";

console.time("Fork");
const forkResult = await fork({ vmId });
console.timeEnd("Fork");
console.log("Fork created:", forkResult);

console.time("Optimize");
const optimizeResult = await optimize({ vmId: forkResult.id });
console.log("Optimize result:", optimizeResult);

export {};
