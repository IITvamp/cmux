export async function checkGitStatus(): Promise<{
  isAvailable: boolean;
  version?: string;
  remoteAccess?: boolean;
  error?: string;
}> {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);
  
  try {
    // Check if git is installed
    const { stdout: versionOutput } = await execAsync("git --version");
    const version = versionOutput.trim().replace("git version ", "");

    // Check if we can reach common git remotes
    let remoteAccess = false;
    try {
      await execAsync("git ls-remote https://github.com/git/git.git HEAD", {
        timeout: 5000,
      });
      remoteAccess = true;
    } catch {
      // Network might be restricted
    }

    return {
      isAvailable: true,
      version,
      remoteAccess,
    };
  } catch (error) {
    return {
      isAvailable: false,
      error: error instanceof Error ? error.message : "Git is not installed",
    };
  }
}