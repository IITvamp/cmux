import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function getGitHubToken(): Promise<string | null> {
  try {
    // Try to get GitHub token from gh CLI
    try {
      const { stdout: ghToken } = await execAsync("gh auth token 2>/dev/null");
      if (ghToken.trim()) {
        return ghToken.trim();
      }
    } catch {
      // gh not available or not authenticated
    }

    return null;
  } catch {
    return null;
  }
}

export async function getGitCredentialsFromHost(): Promise<{
  username?: string;
  password?: string;
} | null> {
  const token = await getGitHubToken();

  if (token) {
    // GitHub tokens use 'oauth' as username
    return {
      username: "oauth",
      password: token,
    };
  }

  return null;
}
