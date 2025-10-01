import { describe, it, expect, beforeAll } from "vitest";
import { ConvexTestingHelper } from "convex-helpers/testing";
import { api } from "./_generated/api";
import schema from "./schema";

describe("GitHub Repository Sync", () => {
  let t: ConvexTestingHelper<typeof schema>;

  beforeAll(async () => {
    t = new ConvexTestingHelper(schema);
    await t.run(async (ctx) => {
      // Create test team
      await ctx.db.insert("teams", {
        teamId: "test-team-id",
        slug: "test-team",
        displayName: "Test Team",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create test user
      await ctx.db.insert("users", {
        userId: "test-user-id",
        primaryEmail: "test@example.com",
        primaryEmailVerified: true,
        displayName: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create team membership
      await ctx.db.insert("teamMemberships", {
        teamId: "test-team-id",
        userId: "test-user-id",
        role: "owner",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create provider connection
      await ctx.db.insert("providerConnections", {
        type: "github_app",
        installationId: 12345,
        teamId: "test-team-id",
        connectedByUserId: "test-user-id",
        accountLogin: "test-org",
        accountId: 67890,
        accountType: "Organization",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  it("should insert repositories without duplicates", async () => {
    const connectionId = await t.run(async (ctx) => {
      const conn = await ctx.db
        .query("providerConnections")
        .withIndex("by_installationId", (q) => q.eq("installationId", 12345))
        .first();
      return conn!._id;
    });

    // Insert first batch
    const result1 = await t.mutation(api.github_repos_sync.insertRepoBatch, {
      teamId: "test-team-id",
      userId: "test-user-id",
      connectionId,
      repos: [
        {
          fullName: "test-org/repo1",
          name: "repo1",
          org: "test-org",
          gitRemote: "https://github.com/test-org/repo1.git",
          provider: "github",
          providerRepoId: 1,
          ownerLogin: "test-org",
          ownerType: "Organization",
          visibility: "public",
          defaultBranch: "main",
        },
        {
          fullName: "test-org/repo2",
          name: "repo2",
          org: "test-org",
          gitRemote: "https://github.com/test-org/repo2.git",
          provider: "github",
          providerRepoId: 2,
          ownerLogin: "test-org",
          ownerType: "Organization",
          visibility: "private",
          defaultBranch: "main",
        },
      ],
    });

    expect(result1.inserted).toBe(2);
    expect(result1.updated).toBe(0);

    // Insert same repos again (should update, not insert)
    const result2 = await t.mutation(api.github_repos_sync.insertRepoBatch, {
      teamId: "test-team-id",
      userId: "test-user-id",
      connectionId,
      repos: [
        {
          fullName: "test-org/repo1",
          name: "repo1",
          org: "test-org",
          gitRemote: "https://github.com/test-org/repo1.git",
          provider: "github",
          providerRepoId: 1,
          ownerLogin: "test-org",
          ownerType: "Organization",
          visibility: "private", // Changed from public
          defaultBranch: "main",
        },
      ],
    });

    expect(result2.inserted).toBe(0);
    expect(result2.updated).toBe(1);

    // Verify final state
    const repos = await t.run(async (ctx) => {
      return await ctx.db
        .query("repos")
        .withIndex("by_team", (q) => q.eq("teamId", "test-team-id"))
        .collect();
    });

    expect(repos.length).toBe(2);
    const repo1 = repos.find((r) => r.providerRepoId === 1);
    expect(repo1?.visibility).toBe("private");
  });

  it("should handle repositories without providerRepoId", async () => {
    const connectionId = await t.run(async (ctx) => {
      const conn = await ctx.db
        .query("providerConnections")
        .withIndex("by_installationId", (q) => q.eq("installationId", 12345))
        .first();
      return conn!._id;
    });

    const result = await t.mutation(api.github_repos_sync.insertRepoBatch, {
      teamId: "test-team-id",
      userId: "test-user-id",
      connectionId,
      repos: [
        {
          fullName: "test-org/repo3",
          name: "repo3",
          org: "test-org",
          gitRemote: "https://github.com/test-org/repo3.git",
          provider: "github",
          ownerLogin: "test-org",
          ownerType: "Organization",
          visibility: "public",
          defaultBranch: "main",
        },
      ],
    });

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
  });
});
