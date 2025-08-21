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
    "morphvm_2dqyuqt0",
)

print("Exposing ports")
ports_to_expose = [9779]
for port in ports_to_expose:
    print(f"Exposing port {port}")
    instance.expose_http_service(f"port-{port}", port)

print("Networking")
print(instance.networking.http_services)

# print("Creating snapshot...")
# # make a snapshot
# snapshot = instance.snapshot()

# print("Snapshot")
# print(snapshot.id)
