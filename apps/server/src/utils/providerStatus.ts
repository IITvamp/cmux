import { api } from "@cmux/convex/api";
import {
  AGENT_CONFIGS,
  checkDockerStatus,
  type DockerStatus,
  type ProviderStatus as SharedProviderStatus,
} from "@cmux/shared";
import { getConvex } from "./convexClient.js";
import { serverLogger } from "./fileLogger.js";

export async function checkAllProvidersStatus(teamSlugOrId: string): Promise<{
  providers: SharedProviderStatus[];
  dockerStatus: DockerStatus;
}> {
  const convexClient = getConvex();

  const [dockerStatus, apiKeys] = await Promise.all([
    checkDockerStatus(),
    convexClient
      .query(api.apiKeys.getAllForAgents, {
        teamSlugOrId,
      })
      .catch((error) => {
        serverLogger.warn(
          "[ProviderStatus] Failed to load API keys for provider checks",
          error
        );
        return {} as Record<string, string>;
      }),
  ]);

  // Check each provider's specific requirements
  const providerChecks = await Promise.all(
    AGENT_CONFIGS.map(async (agent) => {
      // Use the agent's checkRequirements function if available
      const missingRequirements = agent.checkRequirements
        ? await agent.checkRequirements({ apiKeys })
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
