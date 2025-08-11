import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Get the latest snapshot for a task
export const getLatestByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const latest = await ctx.db
      .query("diffSnapshots")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .first();

    if (!latest) return null;

    // Resolve storage URLs for monaco when needed (client might fetch contents directly later)
    const filesWithUrls = await Promise.all(
      latest.files.map(async (f) => {
        const oldUrl = f.oldTextStorageId
          ? await ctx.storage.getUrl(f.oldTextStorageId)
          : undefined;
        const newUrl = f.newTextStorageId
          ? await ctx.storage.getUrl(f.newTextStorageId)
          : undefined;
        return { ...f, oldUrl, newUrl };
      })
    );

    return { ...latest, files: filesWithUrls };
  },
});

// Mark that we are updating the diff snapshot; a worker can populate it later.
export const requestUpdate = mutation({
  args: {
    taskId: v.id("tasks"),
    branch: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, branch, repoUrl }) => {
    const now = Date.now();
    // Insert a lightweight placeholder snapshot with status=updating
    const id = await ctx.db.insert("diffSnapshots", {
      taskId,
      branch,
      repoUrl,
      baseSha: undefined,
      headSha: undefined,
      status: "updating",
      errorMessage: undefined,
      summary: undefined,
      files: [],
      createdAt: now,
      updatedAt: now,
    });
    return id as Id<"diffSnapshots">;
  },
});

// Store a computed snapshot (to be called by background worker)
export const storeSnapshot = mutation({
  args: {
    snapshotId: v.optional(v.id("diffSnapshots")),
    taskId: v.id("tasks"),
    branch: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    baseSha: v.optional(v.string()),
    headSha: v.optional(v.string()),
    summary: v.optional(
      v.object({ filesChanged: v.number(), additions: v.number(), deletions: v.number() })
    ),
    files: v.array(
      v.object({
        path: v.string(),
        status: v.union(
          v.literal("modified"),
          v.literal("added"),
          v.literal("deleted"),
          v.literal("renamed"),
          v.literal("copied")
        ),
        additions: v.number(),
        deletions: v.number(),
        oldTextStorageId: v.optional(v.id("_storage")),
        newTextStorageId: v.optional(v.id("_storage")),
        patch: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const base = {
      taskId: args.taskId,
      branch: args.branch,
      repoUrl: args.repoUrl,
      baseSha: args.baseSha,
      headSha: args.headSha,
      status: "ready" as const,
      errorMessage: undefined as string | undefined,
      summary: args.summary,
      files: args.files,
      updatedAt: now,
    };

    if (args.snapshotId) {
      await ctx.db.patch(args.snapshotId, base);
      return args.snapshotId;
    }

    const id = await ctx.db.insert("diffSnapshots", {
      ...base,
      createdAt: now,
    });
    return id as Id<"diffSnapshots">;
  },
});

