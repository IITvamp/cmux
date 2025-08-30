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
    snapshot_id="snapshot_nhjvul9o",
    ttl_seconds=3600,
    ttl_action="pause",
)

print("instance id:", instance.id)

expose_ports = [39376, 39377, 39378]
for port in expose_ports:
    instance.expose_http_service(port=port, name=f"port-{port}")

print(instance.networking.http_services)
