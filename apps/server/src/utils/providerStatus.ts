import { api } from "@cmux/convex/api";
import {
  AGENT_CONFIGS,
  checkDockerStatus,
  type DockerStatus,
  type ProviderStatus as SharedProviderStatus,
} from "@cmux/shared";
import { getConvex } from "./convexClient.js";
import { getAuthToken } from "./requestContext.js";

export async function checkAllProvidersStatus(
  teamSlugOrId?: string
): Promise<{
  providers: SharedProviderStatus[];
  dockerStatus: DockerStatus;
}> {
  // Check Docker status
  const [dockerStatus] = await Promise.all([checkDockerStatus()]);

  // Fetch API keys from Convex if we have auth and team context
  let apiKeys: Record<string, string> = {};
  try {
    const authToken = getAuthToken();
    if (authToken && teamSlugOrId) {
      const fetchedKeys = await getConvex().query(
        api.apiKeys.getAllForAgents,
        {
          teamSlugOrId,
        }
      );
      apiKeys = fetchedKeys || {};
    }
  } catch (error) {
    // If we can't fetch API keys, continue with empty object
    console.warn("Could not fetch API keys for provider status check:", error);
  }

  // Check each provider's specific requirements
  const providerChecks = await Promise.all(
    AGENT_CONFIGS.map(async (agent) => {
      // Use the agent's checkRequirements function if available
      const missingRequirements = agent.checkRequirements
        ? await agent.checkRequirements(apiKeys)
        : [];

      return {
        name: agent.name,
        isAvailable: missingRequirements.length === 0,
        missingRequirements:
          missingRequirements.length > 0 ? missingRequirements : undefined,
      };
    })
  );

  return {
    providers: providerChecks,
    dockerStatus,
  };
}
