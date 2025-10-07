#!/usr/bin/env bun

import { internal } from "@cmux/convex/api";
import { StackAdminApp, type ServerTeam, type ServerUser, type ServerTeamUser } from "@stackframe/js";
import { ConvexHttpClient } from "convex/browser";

/**
 * Syncs all Stack Auth team memberships to Convex.
 *
 * This script fetches users, teams, and memberships from Stack Auth and
 * persists them to the Convex database. Only syncs missing data.
 *
 * Required environment variables:
 * - NEXT_PUBLIC_CONVEX_URL: Convex deployment URL
 * - CONVEX_DEPLOY_KEY: Convex deployment key for system-level access
 * - STACK_SECRET_SERVER_KEY: Stack Auth secret server key
 * - STACK_SUPER_SECRET_ADMIN_KEY: Stack Auth super secret admin key
 * - NEXT_PUBLIC_STACK_PROJECT_ID: Stack Auth project ID
 * - NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: Stack Auth publishable client key
 *
 * Usage:
 *   bun scripts/sync-stack-memberships.ts [--dry-run] [--skip-users] [--skip-teams] [--skip-memberships]
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipUsers = args.includes("--skip-users");
  const skipTeams = args.includes("--skip-teams");
  const skipMemberships = args.includes("--skip-memberships");
  const pageSize = 200;
  const includeAnonymous = false;

  // Get required environment variables
  const convexUrl = requireEnv("NEXT_PUBLIC_CONVEX_URL");
  const deployKey = requireEnv("CONVEX_DEPLOY_KEY");
  const projectId = requireEnv("NEXT_PUBLIC_STACK_PROJECT_ID");
  const publishableClientKey = requireEnv("NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY");
  const secretServerKey = requireEnv("STACK_SECRET_SERVER_KEY");
  const superSecretAdminKey = requireEnv("STACK_SUPER_SECRET_ADMIN_KEY");

  console.log("🔄 Starting Stack Auth membership sync...");
  console.log(`   Convex URL: ${convexUrl}`);
  console.log(`   Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`   Sync users: ${skipUsers ? "no" : "yes"}`);
  console.log(`   Sync teams: ${skipTeams ? "no" : "yes"}`);
  console.log(`   Sync memberships: ${skipMemberships ? "no" : "yes"}`);
  console.log();

  // Create Stack Admin client
  const admin = new StackAdminApp({
    tokenStore: "memory",
    projectId,
    publishableClientKey,
    secretServerKey,
    superSecretAdminKey,
  });

  // Create Convex client with admin authentication
  const convex = new ConvexHttpClient(convexUrl);
  // Note: setAdminAuth is not in public API but exists in implementation
  // @ts-expect-error - using internal API for admin auth with deploy key
  convex.setAdminAuth(deployKey);

  const stats = {
    usersProcessed: 0,
    usersCreated: 0,
    teamsProcessed: 0,
    teamsCreated: 0,
    membershipsProcessed: 0,
    membershipsCreated: 0,
  };

  try {
    // Sync users
    if (!skipUsers) {
      console.log("📥 Fetching users from Stack Auth...");
      let cursor: string | undefined = undefined;
      for (;;) {
        const page = (await admin.listUsers({
          cursor,
          limit: pageSize,
          includeAnonymous,
        })) as ServerUser[] & { nextCursor: string | null };

        for (const u of page) {
          stats.usersProcessed += 1;
          if (dryRun) continue;

          // Use internal mutation (no auth required with deploy key)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await convex.mutation(internal.stack.upsertUser as any, {
            id: u.id,
            primaryEmail: u.primaryEmail ?? undefined,
            primaryEmailVerified: u.primaryEmailVerified,
            primaryEmailAuthEnabled:
              (u as unknown as { emailAuthEnabled?: boolean }).emailAuthEnabled ?? false,
            displayName: u.displayName ?? undefined,
            selectedTeamId: u.selectedTeam?.id ?? undefined,
            selectedTeamDisplayName: u.selectedTeam?.displayName ?? undefined,
            selectedTeamProfileImageUrl: u.selectedTeam?.profileImageUrl ?? undefined,
            profileImageUrl: u.profileImageUrl ?? undefined,
            signedUpAtMillis: u.signedUpAt.getTime(),
            lastActiveAtMillis: u.lastActiveAt.getTime(),
            hasPassword: u.hasPassword,
            otpAuthEnabled: u.otpAuthEnabled,
            passkeyAuthEnabled: u.passkeyAuthEnabled,
            clientMetadata: u.clientMetadata,
            clientReadOnlyMetadata: u.clientReadOnlyMetadata,
            serverMetadata: (u as unknown as { serverMetadata?: unknown }).serverMetadata,
            isAnonymous: u.isAnonymous,
          });
        }

        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      console.log(`   ✓ Processed ${stats.usersProcessed} users`);
    }

    // Sync teams
    let teams: ServerTeam[] = [];
    if (!skipTeams || !skipMemberships) {
      console.log("📥 Fetching teams from Stack Auth...");
      const list = await admin.listTeams();
      teams = list as ServerTeam[];
    }

    if (!skipTeams) {
      for (const t of teams) {
        stats.teamsProcessed += 1;
        if (dryRun) continue;

        // Use internal mutation (no auth required with deploy key)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await convex.mutation(internal.stack.upsertTeam as any, {
          id: t.id,
          displayName: t.displayName ?? undefined,
          profileImageUrl: t.profileImageUrl ?? undefined,
          clientMetadata: t.clientMetadata,
          clientReadOnlyMetadata: t.clientReadOnlyMetadata,
          serverMetadata: (t as unknown as { serverMetadata?: unknown }).serverMetadata,
          createdAtMillis: t.createdAt.getTime(),
        });
      }
      console.log(`   ✓ Processed ${stats.teamsProcessed} teams`);
    }

    // Sync memberships
    if (!skipMemberships) {
      console.log("📥 Fetching team memberships from Stack Auth...");

      // Fetch all existing memberships from Convex for comparison
      console.log("📊 Fetching existing memberships from Convex...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingMembershipsList = await convex.query(internal.stack.listAllMemberships as any);
      const existingMemberships = new Set<string>(
        existingMembershipsList.map((m: { teamId: string; userId: string }) => `${m.teamId}:${m.userId}`)
      );
      console.log(`   Found ${existingMemberships.size} existing memberships in Convex`);

      for (const t of teams) {
        const members = (await t.listUsers()) as ServerTeamUser[];
        for (const m of members) {
          const membershipKey = `${t.id}:${m.id}`;
          const alreadyExists = existingMemberships.has(membershipKey);

          stats.membershipsProcessed += 1;

          if (alreadyExists) {
            // Skip - already exists
            continue;
          }

          stats.membershipsCreated += 1;

          if (dryRun) {
            console.log(`   Would create: ${membershipKey}`);
            continue;
          }

          // Use internal mutation (no auth required with deploy key)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await convex.mutation(internal.stack.ensureMembership as any, {
            teamId: t.id,
            userId: m.id,
          });
        }
      }
      console.log(
        `   ✓ Processed ${stats.membershipsProcessed} memberships (${stats.membershipsCreated} missing, ${stats.membershipsProcessed - stats.membershipsCreated} already exist)`
      );
    }

    console.log();
    console.log("✅ Sync complete!");
    console.log();
    console.log("📊 Summary:");
    if (!skipUsers) {
      console.log(`   Users processed: ${stats.usersProcessed}`);
    }
    if (!skipTeams) {
      console.log(`   Teams processed: ${stats.teamsProcessed}`);
    }
    if (!skipMemberships) {
      console.log(`   Memberships from Stack Auth: ${stats.membershipsProcessed}`);
      console.log(`   Memberships missing in Convex: ${stats.membershipsCreated}`);
      console.log(`   Memberships already in Convex: ${stats.membershipsProcessed - stats.membershipsCreated}`);
    }

    if (dryRun) {
      console.log();
      console.log("ℹ️  This was a dry run. No data was actually written to Convex.");
      console.log("   Run without --dry-run to persist the changes.");
    }
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

main();
