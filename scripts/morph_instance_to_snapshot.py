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

print("Getting instance")
instance = client.instances.get(
    "morphvm_crnrdvjy",
)

print("Exposing ports")
ports_to_expose = [5173, 9777, 9778, 6791]
for port in ports_to_expose:
    print(f"Exposing port {port}")
    instance.expose_http_service(f"port-{port}", port)

print("Networking")
print(instance.networking.http_services)

# make a snapshot
snapshot = client.snapshots.create(
    vcpus=4,
    memory=4096,
    disk_size=16384,
)

print("Snapshot")
print(snapshot.id)
