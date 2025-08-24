import type {
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { DataModel } from "../convex/_generated/dataModel";

export async function ensureAuth(
  ctx:
    | GenericQueryCtx<DataModel>
    | GenericMutationCtx<DataModel>
    | GenericActionCtx<DataModel>
) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return { ...user, userId: user.subject };
}
