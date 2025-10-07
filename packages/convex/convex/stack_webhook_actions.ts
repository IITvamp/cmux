"use node";

// TODO: we don't need a node action for this once stack auth can run in v8 environments

import { v } from "convex/values";
import { stackServerAppJs } from "../_shared/stackServerAppJs";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function readBooleanFlag(source: unknown): boolean | null {
  const record = asRecord(source);
  if (!record) {
    return null;
  }
  for (const key of ["isLive", "live"]) {
    if (key in record) {
      const interpreted = parseBoolean(record[key]);
      if (interpreted !== null) {
        return interpreted;
      }
    }
  }
  return null;
}

function readEnvironment(source: unknown): string | null {
  const record = asRecord(source);
  if (!record) {
    return null;
  }
  for (const key of ["environment", "env", "stackEnvironment"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}

function isLiveTeam(team: { clientMetadata?: unknown; serverMetadata?: unknown }): boolean {
  const environment =
    readEnvironment(team.serverMetadata) ?? readEnvironment(team.clientMetadata);
  if (environment) {
    if (environment === "stack") {
      return false;
    }
    if (environment === "live" || environment === "production" || environment === "prod") {
      return true;
    }
  }

  const flag = readBooleanFlag(team.serverMetadata) ?? readBooleanFlag(team.clientMetadata);
  if (flag !== null) {
    return flag;
  }

  return true;
}

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

export const ensureUserMembershipsAcrossLiveTeams = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    let teams: Awaited<ReturnType<typeof stackServerAppJs.listTeams>>;
    try {
      teams = await stackServerAppJs.listTeams();
    } catch (error) {
      console.error("[stack_webhook] Failed to list teams for new user", {
        userId,
        error,
      });
      return;
    }

    for (const team of teams) {
      if (!isLiveTeam(team)) {
        continue;
      }

      try {
        const members = await team.listUsers();
        let hasMembership = members.some((member) => member.id === userId);

        if (!hasMembership) {
          try {
            await team.addUser(userId);
            hasMembership = true;
          } catch (addError) {
            console.error("[stack_webhook] Adding user to team failed", {
              userId,
              teamId: team.id,
              error: addError,
            });
            try {
              const refreshedMembers = await team.listUsers();
              hasMembership = refreshedMembers.some((member) => member.id === userId);
            } catch (refreshError) {
              console.error("[stack_webhook] Membership refresh after add failure failed", {
                userId,
                teamId: team.id,
                error: refreshError,
              });
            }
          }
        }

        if (!hasMembership) {
          continue;
        }

        try {
          await ctx.runMutation(internal.stack.ensureMembership, {
            teamId: team.id,
            userId,
          });
        } catch (syncError) {
          console.error("[stack_webhook] Failed to sync membership into Convex", {
            userId,
            teamId: team.id,
            error: syncError,
          });
        }
      } catch (error) {
        console.error("[stack_webhook] Failed processing team for new user", {
          userId,
          teamId: team.id,
          error,
        });
      }
    }
  },
});
