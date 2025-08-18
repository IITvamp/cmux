import { api } from "@cmux/convex/api";
import { exec } from "child_process";
import type { ConvexHttpClient } from "convex/browser";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function getGitHubTokenFromKeychain(
  convex?: ConvexHttpClient
): Promise<string | null> {
  try {
    // Try to get GitHub token from Convex first (user-configured PAT)
    if (convex) {
      try {
        const apiKeys = await convex.query(api.apiKeys.getAll);
        const githubToken = apiKeys.find(
          (key) => key.envVar === "GITHUB_TOKEN"
        );
        if (githubToken?.value) {
          return githubToken.value;
        }
      } catch {
        // Convex not available or query failed
      }
    }

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
  const token = await getGitHubTokenFromKeychain();

  if (token) {
    // GitHub tokens use 'oauth' as username
    return {
      username: "oauth",
      password: token,
    };
  }

  return null;
}
