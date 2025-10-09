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
  const commands: string[][] = [
    ["/usr/bin/git", "config", "--global", "user.name", identity.name],
    ["/usr/bin/git", "config", "--global", "user.email", identity.email],
    ["/usr/bin/git", "config", "--global", "init.defaultBranch", "main"],
  ];

  for (const command of commands) {
    const result = await instance.exec(command);
    if (result.exit_code !== 0) {
      console.error(
        `[sandboxes.start] GIT CONFIG: Failed to run ${command.join(" ")}, exit=${result.exit_code}`
      );
      return;
    }
  }

  const verifyName = await instance.exec([
    "/usr/bin/git",
    "config",
    "--global",
    "--get",
    "user.name",
  ]);
  const verifyEmail = await instance.exec([
    "/usr/bin/git",
    "config",
    "--global",
    "--get",
    "user.email",
  ]);
  if (verifyName.exit_code === 0) {
    console.log(`[sandboxes.start] git user.name=${verifyName.stdout.trim()}`);
  }
  if (verifyEmail.exit_code === 0) {
    console.log(
      `[sandboxes.start] git user.email=${verifyEmail.stdout.trim()}`
    );
  }
};

const toAnsiCQuoted = (value: string): string =>
  `$'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")}'`;

export const configureGithubAccess = async (
  instance: MorphInstance,
  token: string,
  maxRetries = 5
) => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tokenFile = `/tmp/cmux-gh-token-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const tokenFileQuoted = singleQuote(tokenFile);
      const ghAuthCommand = [
        "set -euo pipefail",
        `token_file=${tokenFileQuoted}`,
        'cleanup() { rm -f "$token_file"; }',
        "trap cleanup EXIT",
        "cat <<'CMUX_GH_TOKEN' > \"$token_file\"",
        token,
        "CMUX_GH_TOKEN",
        'gh auth login --with-token < "$token_file"',
        "gh auth setup-git",
      ].join("\n");

      const ghAuthRes = await instance.exec([
        "/bin/bash",
        "-lc",
        toAnsiCQuoted(ghAuthCommand),
      ]);

      if (ghAuthRes.exit_code === 0) {
        return;
      }
      if (ghAuthRes.exit_code === 126 || ghAuthRes.exit_code === 127) {
        console.warn(
          `[sandboxes.start] GIT AUTH: gh CLI unavailable (exit=${ghAuthRes.exit_code}); skipping GitHub auth setup`
        );
        return;
      }

      const errorMessage =
        ghAuthRes.stderr || ghAuthRes.stdout || "Unknown error";
      lastError = new Error(
        `GitHub auth failed: ${maskSensitive(errorMessage).slice(0, 500)}`
      );

      console.error(
        `[sandboxes.start] GIT AUTH: Attempt ${attempt}/${maxRetries} failed: exit=${ghAuthRes.exit_code} stderr=${maskSensitive(
          ghAuthRes.stderr || ""
        ).slice(0, 200)}`
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[sandboxes.start] GIT AUTH: Attempt ${attempt}/${maxRetries} threw error:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(
    `[sandboxes.start] GIT AUTH: GitHub authentication failed after ${maxRetries} attempts`
  );
  throw new Error(
    `GitHub authentication failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
};
