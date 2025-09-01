import { env } from "./www-env";

export const githubPrivateKey = env.GITHUB_APP_PRIVATE_KEY.replace(
  /\\n/g,
  "\n"
);
