import { MorphCloudClient } from "morphcloud";

const client = new MorphCloudClient();
const snapshot = await client.snapshots.create({
  imageId: "morphvm-minimal",
  vcpus: 1,
  memory: 128,
  diskSize: 700,
});

console.log(`Created snapshot: ${snapshot.id}`);
