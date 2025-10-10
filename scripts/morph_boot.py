from morphcloud.api import MorphCloudClient
import httpx
import json
import sys


SNAPSHOT_ID = "snapshot_ml9y7pf4"



def main() -> None:
    client = MorphCloudClient()

    print("booting instance...")
    instance = client.instances.boot(snapshot_id=SNAPSHOT_ID)
    print(f"Created instance: {instance.id}")

    print("waiting for instance to be ready...")
    instance.wait_until_ready()
    print("instance is ready")
    print(instance.networking.http_services)

    print("executing pwd via instance.exec()...")
    print(instance.exec("pwd"))

    print("\ndone!")


if __name__ == "__main__":
    main()
