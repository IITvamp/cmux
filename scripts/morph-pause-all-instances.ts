import { InstanceStatus, MorphCloudClient } from "morphcloud";

const client = new MorphCloudClient();

const instances = await client.instances.list();
const runningInstances = instances.filter(
  (instance) => instance.status === InstanceStatus.READY
);

await Promise.all(
  runningInstances.map(async (instance) => {
    console.log(`Pausing instance ${instance.id}`);
    await instance.pause();
    console.log(`Paused instance ${instance.id}`);
  })
);
console.log("done!");

process.exit(0);
