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
  token: string
) => {
  try {
    const [ghAuthRes] = await Promise.all([
      instance.exec(
        `bash -lc "printf %s ${singleQuote(token)} | gh auth login --with-token && gh auth setup-git 2>&1 || true"`
      ),
    ]);

    console.log(
      `[sandboxes.start] gh auth exit=${ghAuthRes.exit_code} stderr=${maskSensitive(
        ghAuthRes.stderr || ""
      ).slice(0, 200)}`
    );
  } catch (error) {
    console.error("[sandboxes.start] GitHub auth bootstrap failed", error);
  }
};
