import { action, mutation, query } from '../_generated/server';
import { customAction, customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { AuthenticationRequired } from './utils';

export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const identity = await AuthenticationRequired({ ctx });
    const userId = identity.subject;
    const teamId = userId; // For now, use userId as teamId (one user = one team)
    return { userId, teamId };
  }),
);

export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await AuthenticationRequired({ ctx });
    const userId = identity.subject;
    const teamId = userId; // For now, use userId as teamId (one user = one team)
    return { userId, teamId };
  }),
);

export const authAction = customAction(
  action,
  customCtx(async (ctx) => {
    const identity = await AuthenticationRequired({ ctx });
    const userId = identity.subject;
    const teamId = userId; // For now, use userId as teamId (one user = one team)
    return { userId, teamId };
  }),
);
