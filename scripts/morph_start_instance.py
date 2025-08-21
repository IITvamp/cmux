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


instance = client.instances.start(
    "snapshot_wdtqk4gj",
    ttl_seconds=3600,
)

print(instance.exec("docker info").stdout)
