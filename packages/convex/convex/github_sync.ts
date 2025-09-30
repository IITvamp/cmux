import { v } from "convex/values";
import { env } from "../_shared/convex-env";
import {
  base64urlFromBytes,
  base64urlToBytes,
} from "../_shared/encoding";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

function pemToDer(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const base64Url = cleaned
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const binaryString = atob(
    base64Url.replace(/-/g, "+").replace(/_/g, "/")
  );
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function base64urlEncodeJson(value: unknown): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(JSON.stringify(value));
  const binaryString = String.fromCharCode(...bytes);
  const base64 = btoa(binaryString);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto is not available in this environment");
  }
  const der = pemToDer(pem);
  const keyData =
    der.byteOffset === 0 && der.byteLength === der.buffer.byteLength
      ? der
      : der.slice();
  return await subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

async function createGithubAppJwt(
  appId: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" } as const;
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  } as const;
  const signingInput = `${base64urlEncodeJson(header)}.${base64urlEncodeJson(
    payload
  )}`;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto is not available in this environment");
  }
  const key = await importPrivateKey(privateKey);
  const encoder = new TextEncoder();
  const signature = await subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput)
  );
  const signatureBytes = new Uint8Array(signature);
  const signatureBinary = String.fromCharCode(...signatureBytes);
  const signatureBase64 = btoa(signatureBinary);
  const signaturePart = signatureBase64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signingInput}.${signaturePart}`;
}

async function generateInstallationAccessToken(
  appId: string,
  privateKey: string,
  installationId: number
): Promise<string> {
  // Create JWT for app authentication
  const jwt = await createGithubAppJwt(appId, privateKey);

  // Exchange JWT for installation access token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cmux-github-sync",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to generate installation token (status ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  owner?: {
    login?: string;
    type?: string;
  };
  clone_url?: string;
  private?: boolean;
  default_branch?: string;
};

/**
 * Sync all repositories from a GitHub App installation into the repos table.
 * Called when a new installation is created or when a team is first connected.
 */
export const syncRepositoriesForInstallation = internalAction({
  args: {
    installationId: v.number(),
    teamId: v.string(),
    userId: v.optional(v.string()), // Optional: user who triggered the sync
  },
  handler: async (ctx, { installationId, teamId, userId }) => {
    const appId = env.CMUX_GITHUB_APP_ID;
    const privateKey = env.CMUX_GITHUB_APP_PRIVATE_KEY;
    if (!appId || !privateKey) {
      console.error(
        "[github_sync] Missing GitHub App credentials, cannot sync repositories"
      );
      return { synced: 0, error: "Missing GitHub App credentials" };
    }

    try {
      const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n");

      // Generate installation access token
      const token = await generateInstallationAccessToken(
        appId,
        normalizedPrivateKey,
        installationId
      );

      // Fetch all repositories for this installation
      const repos: Array<{
        fullName: string;
        org: string;
        name: string;
        gitRemote: string;
        provider: string;
        providerRepoId: number;
        ownerLogin: string;
        ownerType: "User" | "Organization";
        visibility: "public" | "private";
        defaultBranch: string;
      }> = [];

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "cmux-github-sync",
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[github_sync] Failed to fetch repositories (status ${response.status}): ${errorText}`
          );
          break;
        }

        const data = (await response.json()) as {
          repositories: GitHubRepository[];
        };

        for (const repo of data.repositories) {
          repos.push({
            fullName: repo.full_name,
            org: repo.owner?.login ?? "",
            name: repo.name,
            gitRemote: repo.clone_url ?? `https://github.com/${repo.full_name}.git`,
            provider: "github",
            providerRepoId: repo.id,
            ownerLogin: repo.owner?.login ?? "",
            ownerType: repo.owner?.type === "Organization" ? "Organization" : "User",
            visibility: repo.private ? "private" : "public",
            defaultBranch: repo.default_branch ?? "main",
          });
        }

        hasMore = data.repositories.length === 100;
        page++;
      }

      console.log(
        `[github_sync] Found ${repos.length} repositories for installation ${installationId}`
      );

      // Get the provider connection to link repos
      const connection = await ctx.runQuery(
        internal.github_app.getProviderConnectionByInstallationId,
        { installationId }
      );

      if (!connection) {
        console.error(
          `[github_sync] No provider connection found for installation ${installationId}`
        );
        return { synced: 0, error: "Provider connection not found" };
      }

      // Insert repositories into the repos table
      const syncedCount = await ctx.runMutation(
        internal.github_sync.bulkUpsertReposForTeam,
        {
          teamId,
          userId: userId ?? connection.connectedByUserId ?? "__system__",
          connectionId: connection._id,
          repos,
        }
      );

      console.log(
        `[github_sync] Successfully synced ${syncedCount} repositories for installation ${installationId}`
      );

      return { synced: syncedCount };
    } catch (error) {
      console.error(
        `[github_sync] Failed to sync repositories for installation ${installationId}:`,
        error
      );
      return {
        synced: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Internal mutation to bulk upsert repositories for a team.
 * Updates existing repos or inserts new ones.
 */
export const bulkUpsertReposForTeam = internalMutation({
  args: {
    teamId: v.string(),
    userId: v.string(),
    connectionId: v.id("providerConnections"),
    repos: v.array(
      v.object({
        fullName: v.string(),
        org: v.string(),
        name: v.string(),
        gitRemote: v.string(),
        provider: v.string(),
        providerRepoId: v.number(),
        ownerLogin: v.string(),
        ownerType: v.union(v.literal("User"), v.literal("Organization")),
        visibility: v.union(v.literal("public"), v.literal("private")),
        defaultBranch: v.string(),
      })
    ),
  },
  handler: async (ctx, { teamId, userId, connectionId, repos }) => {
    const now = Date.now();
    let syncedCount = 0;

    for (const repo of repos) {
      // Check if repo already exists
      const existing = await ctx.db
        .query("repos")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .filter((q) => q.eq(q.field("fullName"), repo.fullName))
        .first();

      if (existing) {
        // Update existing repo
        await ctx.db.patch(existing._id, {
          org: repo.org,
          name: repo.name,
          gitRemote: repo.gitRemote,
          provider: repo.provider,
          providerRepoId: repo.providerRepoId,
          ownerLogin: repo.ownerLogin,
          ownerType: repo.ownerType,
          visibility: repo.visibility,
          defaultBranch: repo.defaultBranch,
          connectionId,
          lastSyncedAt: now,
        });
      } else {
        // Insert new repo
        await ctx.db.insert("repos", {
          fullName: repo.fullName,
          org: repo.org,
          name: repo.name,
          gitRemote: repo.gitRemote,
          provider: repo.provider,
          providerRepoId: repo.providerRepoId,
          ownerLogin: repo.ownerLogin,
          ownerType: repo.ownerType,
          visibility: repo.visibility,
          defaultBranch: repo.defaultBranch,
          connectionId,
          userId,
          teamId,
          lastSyncedAt: now,
        });
      }
      syncedCount++;
    }

    return syncedCount;
  },
});
