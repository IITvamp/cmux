import { 
  AGENT_CONFIGS, 
  checkDockerStatus, 
  checkGitStatus 
} from "@cmux/shared";

export interface ProviderStatus {
  name: string;
  isAvailable: boolean;
  missingRequirements?: string[];
  dockerStatus?: {
    isRunning: boolean;
    version?: string;
    error?: string;
  };
  gitStatus?: {
    isAvailable: boolean;
    version?: string;
    remoteAccess?: boolean;
    error?: string;
  };
}

export async function checkAllProvidersStatus(): Promise<{
  providers: ProviderStatus[];
  dockerStatus: ProviderStatus["dockerStatus"];
  gitStatus: ProviderStatus["gitStatus"];
}> {
  // Check Docker and Git status once
  const [dockerStatus, gitStatus] = await Promise.all([
    checkDockerStatus(),
    checkGitStatus(),
  ]);

  // Check each provider's specific requirements
  const providerChecks = await Promise.all(
    AGENT_CONFIGS.map(async (agent) => {
      // Use the agent's checkRequirements function if available
      const missingRequirements = agent.checkRequirements
        ? await agent.checkRequirements()
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
    gitStatus,
  };
}
