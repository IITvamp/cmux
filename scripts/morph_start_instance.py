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
    snapshot_id="snapshot_puu7fuxk",
    ttl_seconds=3600,
    ttl_action="pause",
)
instance.wait_until_ready()

print("instance id:", instance.id)

expose_ports = [39376, 39377, 39378]
for port in expose_ports:
    instance.expose_http_service(port=port, name=f"port-{port}")

print(instance.networking.http_services)

# listen for any keypress, then snapshot
input("Press Enter to snapshot...")
final_snapshot = instance.snapshot()
print(f"Snapshot ID: {final_snapshot.id}")
