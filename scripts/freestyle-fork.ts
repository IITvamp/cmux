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

const vmId = "bqavy";
// const vmId = "hwfod"; // suspended one
// const vmId = "zbnra"; // stopped one

console.log("Forking VM:", vmId);
console.time("Fork");
const forkResult = await fork({ vmId });
console.log("Fork created:", forkResult);
console.timeEnd("Fork");

async function exec({ vmId, command }: { vmId: string; command: string }) {
  const result = await fetch(
    `https://api.freestyle.sh/v1/vms/${vmId}/exec-await`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FREESTYLE_API_KEY}`,
      },
      body: JSON.stringify({ command, terminal: null }),
    }
  );
  return await result.json();
}

// Test the forked VM by executing a command
console.log(
  "Testing forked VM:",
  await exec({ vmId: forkResult.id, command: "echo 'Hello, World!'" })
);

export {};
