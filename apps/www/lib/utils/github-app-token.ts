import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { githubPrivateKey } from "./githubPrivateKey";
import { env } from "./www-env";

interface GenerateInstallationTokenOptions {
  installationId: number;
  repositories?: string[];
  permissions?: {
    actions?: "read" | "write";
    checks?: "read" | "write";
    contents?: "read" | "write";
    deployments?: "read" | "write";
    issues?: "read" | "write";
    metadata?: "read";
    pull_requests?: "read" | "write";
    statuses?: "read" | "write";
  };
}

export async function generateGitHubInstallationToken({
  installationId,
  repositories,
  permissions = {
    contents: "write",
    metadata: "read",
  },
}: GenerateInstallationTokenOptions): Promise<string> {
  console.log(`[GitHub App] Generating token for installation ${installationId}`);
  console.log(`[GitHub App] Requested repositories:`, repositories);
  console.log(`[GitHub App] Requested permissions:`, permissions);
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: githubPrivateKey,
      installationId,
    },
  });

  const requestBody: {
    permissions: typeof permissions;
    repositories?: string[];
  } = {
    permissions,
  };

  if (repositories && repositories.length > 0) {
    const repoNames = repositories.map((repo) => {
      const parts = repo.split("/");
      return parts[parts.length - 1];
    });
    requestBody.repositories = repoNames;
    console.log(`[GitHub App] Repository names for token scope:`, repoNames);
  }

  try {
    console.log(`[GitHub App] Requesting token with body:`, JSON.stringify(requestBody, null, 2));
    
    const { data } = await octokit.request(
      "POST /app/installations/{installation_id}/access_tokens",
      {
        installation_id: installationId,
        ...requestBody,
      }
    );

    console.log(`[GitHub App] Successfully generated token with expiry: ${data.expires_at}`);
    console.log(`[GitHub App] Token has access to ${data.repositories?.length || "all"} repositories`);
    
    return data.token;
  } catch (error) {
    console.error(`[GitHub App] Failed to generate token:`, error);
    if (error && typeof error === 'object' && 'status' in error) {
      const httpError = error as { status: number; response?: { data?: unknown } };
      console.error(`[GitHub App] Error status: ${httpError.status}`);
      console.error(`[GitHub App] Error response:`, httpError.response?.data);
    }
    throw error;
  }
}

export async function getInstallationForRepo(
  repository: string
): Promise<number | null> {
  // Extract owner from repository (format: owner/repo)
  const [owner] = repository.split("/");
  if (!owner) return null;

  console.log(`[GitHub App] Looking for installation for owner: ${owner}`);

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: githubPrivateKey,
    },
  });

  try {
    // Get the installation for this specific owner/org
    const { data } = await octokit.request(
      "GET /users/{username}/installation",
      { username: owner }
    ).catch(() => {
      console.log(`[GitHub App] ${owner} is not a user, trying as organization`);
      // If not a user, try as an org
      return octokit.request("GET /orgs/{org}/installation", { org: owner });
    });

    console.log(`[GitHub App] Found installation ${data.id} for ${owner}`);
    console.log(`[GitHub App] Installation permissions:`, data.permissions);
    console.log(`[GitHub App] Installation events:`, data.events);
    
    return data.id;
  } catch (error) {
    console.error(`[GitHub App] No installation found for ${owner}:`, error);
    return null;
  }
}