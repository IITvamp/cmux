import { MorphCloudClient } from "morphcloud";

const client = new MorphCloudClient();

const instances = await client.instances.list();

console.log(`Deleting ${instances.length} instances in parallel...`);

await Promise.all(
  instances.map(async (instance) => {
    console.log(`Deleting instance ${instance.id}`);
    await instance.stop();
  })
);
