export default {
  providers: [
    {
      type: "customJwt",
      issuer:
        "https://api.stack-auth.com/api/v1/projects/8a877114-b905-47c5-8b64-3a2d90679577/.well-known/jwks.json",
      jwks: `https://api.stack-auth.com/api/v1/projects/8a877114-b905-47c5-8b64-3a2d90679577/.well-known/jwks.json`,
      applicationID: "8a877114-b905-47c5-8b64-3a2d90679577",
      algorithm: "ES256",
    },
  ],
};
