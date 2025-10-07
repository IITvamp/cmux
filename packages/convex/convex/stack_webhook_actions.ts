"use node";

// TODO: we don't need a node action for this once stack auth can run in v8 environments

import { v } from "convex/values";
import { stackServerAppJs } from "../_shared/stackServerAppJs";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const syncTeamMembershipsFromStack = internalAction({
  args: { teamId: v.string() },
  handler: async (ctx, { teamId }) => {
    try {
      const team = await stackServerAppJs.getTeam(teamId);
      if (!team) {
        console.warn(
          "[stack_webhook] Team not found in Stack during membership sync",
          {
            teamId,
          },
        );
        return;
      }

      const members = await team.listUsers();
      await Promise.all(
        members.map((member) =>
          ctx.runMutation(internal.stack.ensureMembership, {
            teamId,
            userId: member.id,
          }),
        ),
      );
    } catch (error) {
      console.error("[stack_webhook] Failed to sync team memberships", {
        teamId,
        error,
      });
    }
  },
});

export const syncUserTeamMembershipsFromStack = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    try {
      const user = await stackServerAppJs.getUser(userId);
      if (!user) {
        console.warn(
          "[stack_webhook] User not found in Stack during team membership sync",
          {
            userId,
          },
        );
        return;
      }

      const teams = await user.listTeams();
      await Promise.all(
        teams.map((team) =>
          ctx.runMutation(internal.stack.ensureMembership, {
            teamId: team.id,
            userId,
          }),
        ),
      );
    } catch (error) {
      console.error("[stack_webhook] Failed to sync user team memberships", {
        userId,
        error,
      });
    }
  },
});
