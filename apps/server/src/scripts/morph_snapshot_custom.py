# /// script
# dependencies = [
#   "morphcloud",
#   "requests",
# ]
# ///

#!/usr/bin/env python3


import dotenv
from morphcloud.api import MorphCloudClient

dotenv.load_dotenv()

client = MorphCloudClient()

instance_id = "morphvm_ohhalfmd"

instance = client.instances.get(instance_id)

snapshot = instance.snapshot()

print(snapshot)
print(f"Snapshot ID: {snapshot.id}")
