const FREESTYLE_API_KEY = process.env.FREESTYLE_API_KEY;
if (!FREESTYLE_API_KEY) {
  throw new Error("FREESTYLE_API_KEY is not set");
}

async function resize({ vmId, sizeMb }: { vmId: string; sizeMb: number }) {
  const result = await fetch(`https://api.freestyle.sh/v1/vms/${vmId}/resize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FREESTYLE_API_KEY}`,
    },
    body: JSON.stringify({
      sizeMb,
    }),
  });

  if (!result.ok) {
    console.log(await result.text());
    throw new Error(`Resize failed: ${result.status} ${result.statusText}`);
  }

  return await result.json();
}

const vmId = "bqavy";
const sizeMb = 32768;

const result = await resize({ vmId, sizeMb });
console.log(result);

export {};
