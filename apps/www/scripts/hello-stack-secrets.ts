import { env } from "@/lib/utils/www-env";
import { StackAdminApp } from "@stackframe/js";

const stackAdminApp = new StackAdminApp({
  tokenStore: "memory",
  projectId: env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  secretServerKey: env.STACK_SECRET_SERVER_KEY,
  superSecretAdminKey: env.STACK_SUPER_SECRET_ADMIN_KEY,
});
const store = await stackAdminApp.getDataVaultStore("cmux-snapshot-envs");
console.log("setting value");
await store.setValue("testing123", "a very secure cat", {
  secret: env.STACK_DATA_VAULT_SECRET,
});

console.log("getting value");
const value = await store.getValue("testing123", {
  secret: env.STACK_DATA_VAULT_SECRET,
});
console.log("value", value);
