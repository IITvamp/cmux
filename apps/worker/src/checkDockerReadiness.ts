import { Agent, fetch } from "undici";
import { access, constants } from "node:fs/promises";

export async function checkDockerReadiness(): Promise<boolean> {
  const socketPath = "/var/run/docker.sock";

  // First, check if the Docker socket exists
  try {
    await access(socketPath, constants.F_OK);
  } catch (_error) {
    // Socket doesn't exist yet - Docker hasn't started
    return false;
  }

  const agent = new Agent({
    connect: {
      socketPath,
    },
  });

  const maxRetries = 100; // 10 seconds / 0.1 seconds
  const retryDelay = 100; // 100ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("http://localhost/_ping", {
        dispatcher: agent,
        signal: AbortSignal.timeout(1000), // 1 second timeout per attempt
      });

      if (response.ok) {
        agent.close();
        return true;
      }
    } catch (_error) {
      // Ignore errors and retry
    }

    // Wait before retrying (except on last attempt)
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  agent.close();
  return false;
}
