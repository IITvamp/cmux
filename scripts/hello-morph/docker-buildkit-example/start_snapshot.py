# snapshot_2lj87jj7

from dotenv import load_dotenv
from morphcloud.api import MorphCloudClient

load_dotenv()


client = MorphCloudClient()

snapshot_id = "snapshot_ojixukjb"
# snapshot_id = "snapshot_2lj87jj7"

instance = client.instances.start(snapshot_id=snapshot_id)
print(f"Created instance: {instance.id}")

instance.expose_http_service("openvscode", 2376)
instance.expose_http_service("worker", 3002)
instance.expose_http_service("management", 3003)

for service in instance.networking.http_services:
    if service.name == "openvscode":
        print(f"- OpenVSCode: {service.url}/?folder=/root/workspace")
        continue
    print(f"- {service.name}: {service.url}")
