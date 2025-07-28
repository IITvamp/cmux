export async function checkDockerStatus(): Promise<{
  isRunning: boolean;
  version?: string;
  error?: string;
}> {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);
  
  try {
    // Check if Docker is running
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'"
    );
    const version = versionOutput.trim();

    // Check if Docker daemon is accessible
    await execAsync("docker ps");

    return {
      isRunning: true,
      version,
    };
  } catch (error) {
    return {
      isRunning: false,
      error:
        error instanceof Error
          ? error.message
          : "Docker is not running or not installed",
    };
  }
}