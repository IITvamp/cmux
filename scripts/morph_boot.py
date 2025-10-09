from morphcloud.api import MorphCloudClient
import httpx
import json
import sys


SNAPSHOT_ID = "snapshot_lj5iqb09"
STREAM_TIMEOUT = httpx.Timeout(timeout=30.0, read=None)
STREAM_HEADERS = {"Content-Type": "application/json"}


def stream_exec(execd_url: str, command: str) -> None:
    print(f"\n=== Testing /exec with {command!r} command (streaming) ===")
    try:
        with httpx.stream(
            "POST",
            f"{execd_url}/exec",
            json={"command": command},
            headers=STREAM_HEADERS,
            timeout=STREAM_TIMEOUT,
        ) as response:
            status = response.status_code
            print(f"Status: {status}")
            if status != 200:
                body = response.read()
                print(f"Response: {body.decode('utf-8', 'replace')}")
                return
            print("Response (JSONL):")
            for line in response.iter_lines():
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    print(f"  <invalid JSON> {line}")
                    continue
                print(f"  {event}")
    except httpx.HTTPError as error:
        print(f"Request failed: {error}")


def main() -> None:
    client = MorphCloudClient()

    print("booting instance...")
    instance = client.instances.boot(snapshot_id=SNAPSHOT_ID)
    print(f"Created instance: {instance.id}")

    print("waiting for instance to be ready...")
    instance.wait_until_ready()
    print("instance is ready")
    print(instance.networking.http_services)

    execd_service = None
    for service in instance.networking.http_services:
        if service.port == 39375:
            execd_service = service
            break

    if not execd_service:
        print("ERROR: execd service on port 39375 not found!")
        sys.exit(1)

    execd_url = execd_service.url
    print(f"\nFound execd service: {execd_url}")

    print("\n=== Testing /healthz ===")
    health_response = httpx.get(f"{execd_url}/healthz", timeout=30.0)
    print(f"Status: {health_response.status_code}")
    print(f"Response: {health_response.text}")

    # stream_exec(execd_url, "pwd")
    # stream_exec(execd_url, "ls -la")
    # stream_exec(execd_url, "echo stdout && echo stderr >&2")

    # print("\n=== Comparing with instance.exec() ===")
    print("executing pwd via instance.exec()...")
    print(instance.exec("pwd"))

    print("\ndone!")


if __name__ == "__main__":
    main()
