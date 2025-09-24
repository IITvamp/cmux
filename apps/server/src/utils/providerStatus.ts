import { api } from "@cmux/convex/api";
import {
  AGENT_CONFIGS,
  checkDockerStatus,
  type DockerStatus,
  type ProviderStatus as SharedProviderStatus,
} from "@cmux/shared";
import { getConvex } from "./convexClient.js";

export async function checkAllProvidersStatus(
  teamSlugOrId?: string
): Promise<{
  providers: SharedProviderStatus[];
  dockerStatus: DockerStatus;
}> {
  // Check Docker status
  const [dockerStatus] = await Promise.all([checkDockerStatus()]);

  // Fetch API keys from database if team is provided
  let dbApiKeys: Record<string, string> = {};
  if (teamSlugOrId) {
    try {
      const apiKeys = await getConvex().query(api.apiKeys.getAllForAgents, {
        teamSlugOrId,
      });
      dbApiKeys = Object.fromEntries(
        apiKeys.map((key) => [key.envVar, key.value])
      );
    } catch (error) {
      // If we can't fetch API keys from DB, continue with file-based checks only
      console.warn("Failed to fetch API keys from database:", error);
    }
  }

  // Check each provider's specific requirements
  const providerChecks = await Promise.all(
    AGENT_CONFIGS.map(async (agent) => {
      let missingRequirements: string[] = [];

      // First check using the agent's checkRequirements function
      if (agent.checkRequirements) {
        missingRequirements = await agent.checkRequirements();
      }

      // If requirements are missing, check if we have the API key in database
      if (missingRequirements.length > 0 && agent.apiKeys) {
        const hasAllKeysInDb = agent.apiKeys.every(
          (keyConfig) => dbApiKeys[keyConfig.envVar]
        );

        if (hasAllKeysInDb) {
          // Filter out authentication-related missing requirements since we have API keys in DB
          missingRequirements = missingRequirements.filter(
            (req) =>
              !req.toLowerCase().includes("oauth") &&
              !req.toLowerCase().includes("api key") &&
              !req.toLowerCase().includes("authentication")
          );
        }
      }

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
