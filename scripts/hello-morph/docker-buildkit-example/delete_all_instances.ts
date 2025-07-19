import { MorphCloudClient } from "morphcloud";

const client = new MorphCloudClient();

const instances = await client.instances.list();

for (const instance of instances) {
  console.log(`Deleting instance ${instance.id}`);
  await instance.stop();
}
