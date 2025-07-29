import { 
  AGENT_CONFIGS, 
  checkDockerStatus, 
  checkGitStatus,
  type DockerStatus,
  type GitStatus,
  type ProviderStatus as SharedProviderStatus
} from "@cmux/shared";

export async function checkAllProvidersStatus(): Promise<{
  providers: SharedProviderStatus[];
  dockerStatus: DockerStatus;
  gitStatus: GitStatus;
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
