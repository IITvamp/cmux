import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { ReplaceDiffEntry } from "@cmux/shared/diff-types";

export interface GitDiffOptions {
  headRef: string;
  baseRef?: string;
  repoFullName?: string;
  repoUrl?: string;
  teamSlugOrId?: string;
  originPathOverride?: string;
  includeContents?: boolean;
  maxBytes?: number;
}

type NativeGitModule = {
  // napi-rs exports as camelCase
  gitDiff?: (opts: GitDiffOptions) => Promise<ReplaceDiffEntry[]>;
  gitListRemoteBranches?: (opts: {
    repoFullName?: string;
    repoUrl?: string;
    originPathOverride?: string;
  }) => Promise<
    Array<{
      name: string;
      lastCommitSha?: string;
      lastActivityAt?: number;
      isDefault?: boolean;
    }>
  >;
};

function tryLoadNative(): NativeGitModule | null {
  try {
    const nodeRequire = createRequire(import.meta.url);
    const here = path.dirname(fileURLToPath(import.meta.url));
    const plat = process.platform;
    const arch = process.arch;

    const dirCandidates = [
      process.env.CMUX_NATIVE_CORE_DIR,
      typeof (process as unknown as { resourcesPath?: string })
        .resourcesPath === "string"
        ? path.join(
            (process as unknown as { resourcesPath: string }).resourcesPath,
            "native",
            "core"
          )
        : undefined,
      fileURLToPath(new URL("../../native/core/", import.meta.url)),
      path.resolve(here, "../../../server/native/core"),
      path.resolve(here, "../../../../apps/server/native/core"),
      path.resolve(process.cwd(), "../server/native/core"),
      path.resolve(process.cwd(), "../../apps/server/native/core"),
      path.resolve(process.cwd(), "apps/server/native/core"),
      path.resolve(process.cwd(), "server/native/core"),
    ];

    for (const maybeDir of dirCandidates) {
      const nativeDir = maybeDir ?? "";
      if (!nativeDir) continue;
      try {
        const files = fs.readdirSync(nativeDir);
        const nodes = files.filter((f) => f.endsWith(".node"));
        const preferred =
          nodes.find((f) => f.includes(plat) && f.includes(arch)) || nodes[0];
        if (!preferred) continue;
        const mod = nodeRequire(
          path.join(nativeDir, preferred)
        ) as unknown as NativeGitModule;
        return mod ?? null;
      } catch {
        // try next
      }
    }
    return null;
  } catch {
    return null;
  }
}

let cachedNative: NativeGitModule | null | undefined;
export function loadNativeGit(): NativeGitModule | null {
  if (cachedNative === undefined) {
    cachedNative = tryLoadNative();
  }
  return cachedNative ?? null;
}

export async function gitDiff(opts: GitDiffOptions): Promise<ReplaceDiffEntry[]> {
  const mod = loadNativeGit();
  if (!mod?.gitDiff) {
    throw new Error("Native gitDiff not available; rebuild @cmux/native-core");
  }
  return mod.gitDiff(opts);
}

export async function listRemoteBranches(opts: {
  repoFullName?: string;
  repoUrl?: string;
  originPathOverride?: string;
}): Promise<
  Array<{
    name: string;
    lastCommitSha?: string;
    lastActivityAt?: number;
    isDefault?: boolean;
  }>
> {
  const mod = loadNativeGit();
  if (!mod?.gitListRemoteBranches) {
    throw new Error(
      "Native gitListRemoteBranches not available; rebuild @cmux/native-core"
    );
  }
  return mod.gitListRemoteBranches(opts);
}
