import { env } from "../_shared/convex-env";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `https://api.stack-auth.com/api/v1/projects/${env.NEXT_PUBLIC_STACK_PROJECT_ID}`,
      jwks: `https://api.stack-auth.com/api/v1/projects/${env.NEXT_PUBLIC_STACK_PROJECT_ID}/.well-known/jwks.json`,
      applicationID: env.NEXT_PUBLIC_STACK_PROJECT_ID,
      algorithm: "ES256",
    },
  ],
};
