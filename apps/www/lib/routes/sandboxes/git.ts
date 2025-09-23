import { fetchGithubUserInfoForRequest } from "@/lib/utils/githubUserInfo";
import { api } from "@cmux/convex/api";

import type { MorphCloudClient } from "morphcloud";

import type { ConvexClient } from "./snapshot";
import { maskSensitive, singleQuote } from "./shell";

export type MorphInstance = Awaited<
  ReturnType<MorphCloudClient["instances"]["start"]>
>;

export const fetchGitIdentityInputs = (
  convex: ConvexClient,
  githubAccessToken: string
) =>
  Promise.all([
    convex.query(api.users.getCurrentBasic, {}),
    fetchGithubUserInfoForRequest(githubAccessToken),
  ] as const);

export const configureGitIdentity = async (
  instance: MorphInstance,
  identity: { name: string; email: string }
) => {
  const gitCfgRes = await instance.exec(
    `bash -lc "git config --global user.name ${singleQuote(identity.name)} && git config --global user.email ${singleQuote(identity.email)} && git config --global init.defaultBranch main && echo NAME:$(git config --global --get user.name) && echo EMAIL:$(git config --global --get user.email) || true"`
  );
  console.log(
    `[sandboxes.start] git identity configured exit=${gitCfgRes.exit_code} (${identity.name} <${identity.email}>)`
  );
};

export const configureGithubAccess = async (
  instance: MorphInstance,
  token: string,
  maxRetries = 3
) => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ghAuthRes = await instance.exec(
        `bash -lc "printf %s ${singleQuote(token)} | gh auth login --with-token && gh auth setup-git 2>&1"`
      );

      // Check if authentication was successful
      if (ghAuthRes.exit_code === 0) {
        console.log(
          `[sandboxes.start] gh auth successful on attempt ${attempt}/${maxRetries}`
        );
        return;
      }

      // Authentication failed
      const errorMessage = ghAuthRes.stderr || ghAuthRes.stdout || "Unknown error";
      lastError = new Error(`GitHub auth failed: ${maskSensitive(errorMessage).slice(0, 500)}`);

      console.error(
        `[sandboxes.start] gh auth attempt ${attempt}/${maxRetries} failed: exit=${ghAuthRes.exit_code} stderr=${maskSensitive(
          ghAuthRes.stderr || ""
        ).slice(0, 200)}`
      );

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[sandboxes.start] Retrying GitHub auth in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[sandboxes.start] GitHub auth attempt ${attempt}/${maxRetries} threw error:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[sandboxes.start] Retrying GitHub auth in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `GitHub authentication failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
};
