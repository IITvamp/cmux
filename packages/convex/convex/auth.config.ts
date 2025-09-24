import { createRequire } from "module";
import { env } from "../_shared/convex-env";

const require = createRequire(import.meta.url);

type GetConvexProvidersConfig = (options: {
  projectId?: string;
}) => Array<{
  type: string;
  [key: string]: unknown;
}>;

const legacyGetConvexProvidersConfig: GetConvexProvidersConfig = ({
  projectId,
}) => {
  if (!projectId) {
    return [];
  }
  return [
    {
      type: "customJwt",
      issuer: `https://api.stack-auth.com/api/v1/projects/${projectId}`,
      jwks: `https://api.stack-auth.com/api/v1/projects/${projectId}/.well-known/jwks.json`,
      applicationID: projectId,
      algorithm: "ES256",
    },
  ];
};

let getConvexProvidersConfig: GetConvexProvidersConfig =
  legacyGetConvexProvidersConfig;

try {
  const maybeStackModule = require("@stackframe/stack");
  if (maybeStackModule?.getConvexProvidersConfig) {
    getConvexProvidersConfig =
      maybeStackModule.getConvexProvidersConfig as GetConvexProvidersConfig;
  }
} catch (error) {
  console.warn(
    "[StackAuth] Falling back to legacy Convex provider configuration",
    error instanceof Error ? error.message : error
  );
}

export default {
  providers: getConvexProvidersConfig({
    projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  }),
};
