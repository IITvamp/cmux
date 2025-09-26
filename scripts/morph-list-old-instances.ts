import "dotenv/config";
import { MorphCloudClient } from "morphcloud";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const client = new MorphCloudClient();
const now = Date.now();

const instances = await client.instances.list();

const staleInstances = instances
  .map((instance) => {
    const createdMs = instance.created * 1000; // API returns seconds since epoch
    return {
      instance,
      createdMs,
      ageMs: now - createdMs,
    };
  })
  .filter(({ ageMs }) => ageMs >= ONE_WEEK_MS)
  .sort((a, b) => a.createdMs - b.createdMs);

if (staleInstances.length === 0) {
  console.log("No morph instances older than one week.");
  process.exit(0);
}

console.log(
  `Found ${staleInstances.length} morph instance${
    staleInstances.length === 1 ? "" : "s"
  } older than one week:`
);

for (const { instance, createdMs, ageMs } of staleInstances) {
  const details = [
    `• ${instance.id}`,
    `status=${instance.status}`,
    `created=${new Date(createdMs).toISOString()}`,
    `age=${formatDuration(ageMs)}`,
  ];

  if (instance.ttl?.ttlExpireAt) {
    details.push(
      `ttlExpires=${new Date(instance.ttl.ttlExpireAt * 1000).toISOString()}`
    );
  }

  if (instance.metadata && Object.keys(instance.metadata).length > 0) {
    details.push(`metadata=${formatMetadata(instance.metadata)}`);
  }

  console.log(details.join(" | "));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (parts.length === 0 || seconds) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function formatMetadata(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}
