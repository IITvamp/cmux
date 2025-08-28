import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';
import { ConvexError } from 'convex/values';

export async function AuthenticationRequired({
  ctx,
}: {
  ctx: QueryCtx | MutationCtx | ActionCtx;
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError('Not authenticated!');
  }
  return identity;
}
