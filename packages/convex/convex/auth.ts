import { ConvexError } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

/** Checks if the current user is authenticated. Throws if not */
export async function AuthenticationRequired({
  ctx,
}: {
  ctx: QueryCtx | MutationCtx | ActionCtx;
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Not authenticated!");
  }
  
  // Get teamId from the user's token data
  const teamId = (identity.teamId as string | undefined) ?? identity.subject;
  const userId = identity.subject;
  
  if (!teamId || !userId) {
    throw new ConvexError("Invalid authentication: missing teamId or userId");
  }
  
  return { userId, teamId, identity };
}

/** Custom query that requires authentication */
export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const { userId, teamId } = await AuthenticationRequired({ ctx });
    return { userId, teamId };
  }),
);

/** Custom mutation that requires authentication */
export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const { userId, teamId } = await AuthenticationRequired({ ctx });
    return { userId, teamId };
  }),
);

/** Custom action that requires authentication */
export const authAction = customAction(
  action,
  customCtx(async (ctx) => {
    const { userId, teamId } = await AuthenticationRequired({ ctx });
    return { userId, teamId };
  }),
);