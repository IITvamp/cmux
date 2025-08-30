import { api } from "@cmux/convex/api";
import { createAppAuth } from "@octokit/auth-app";
import { StackAdminApp } from "@stackframe/js";
import { ConvexHttpClient } from "convex/browser";
import { Octokit } from "octokit";

const stackAdminApp = new StackAdminApp({
  tokenStore: "memory",
  projectId: process.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: process.env.STACK_SECRET_SERVER_KEY,
  superSecretAdminKey: process.env.STACK_SUPER_SECRET_ADMIN_KEY,
});

const user = await stackAdminApp.getUser(
  "477b6de8-075a-45ea-9c59-f65a65cb124d"
);

if (!user) {
  throw new Error("User not found");
}

const session = await user.createSession({ expiresInMillis: 10_000_000 });
const stackAuthTokens = await session.getTokens();

const stackAuthToken = stackAuthTokens.accessToken;
if (!stackAuthToken) {
  throw new Error("Token not found");
}

const url = "https://polite-canary-804.convex.cloud";

const client = new ConvexHttpClient(url);
client.setAuth(stackAuthToken);

const result = await client.query(api.github.listProviderConnections, {
  teamSlugOrId: "lawrence",
});

console.log(result);

// For each provider connection (GitHub App installation), use an installation token
// so private repos are included. Do NOT use the user's OAuth token here.
const appId = process.env.GITHUB_APP_ID;
const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;

if (!appId || !privateKeyRaw) {
  throw new Error(
    "Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY in environment."
  );
}

const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

await Promise.all(
  result
    .filter((c) => c.isActive)
    .map(async (connection) => {
      if (!connection.installationId) {
        throw new Error("Missing installationId for connection");
      }

      // Create an Octokit client authenticated as the app installation
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId,
          privateKey,
          installationId: connection.installationId,
        },
      });

      // List repositories accessible to this installation (includes private)
      try {
        const { data } = await octokit.request(
          "GET /installation/repositories",
          { per_page: 100 }
        );

        const repos = data.repositories.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          private: r.private,
        }));

        console.log(repos);
      } catch (err) {
        const e = err as { status?: number; message?: string };
        console.error(
          `Failed to list repos for installation ${connection.installationId} (${connection.accountLogin ?? "unknown"})`,
          e
        );
      }
    })
);
