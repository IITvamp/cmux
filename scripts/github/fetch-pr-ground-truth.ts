#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const API_ROOT = "https://api.github.com";
const DEFAULT_REPOS: RepoSlug[] = ["manaflow-ai/cmux", "stack-auth/stack-auth"];
const OUTPUT_DIR = resolve(process.cwd(), "data", "github");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "pr-ground-truth.json");
const PER_PAGE = 100;
const API_VERSION = "2022-11-28";
const CONCURRENCY = 6;

type RepoSlug = `${string}/${string}`;

type PullRequestState = "open" | "closed";

type PullRequestListItem = {
  number: number;
  title: string;
  state: PullRequestState;
  closed_at: string | null;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  merge_commit_sha: string | null;
};

type PullRequestDetail = PullRequestListItem & {
  additions: number;
  deletions: number;
  changed_files: number;
};

type PullRequestCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string | null; email: string | null; date: string | null } | null;
  };
  author: { login: string | null } | null;
};

type Paginated<T> = {
  data: T;
  next: string | null;
};

type StoredPullRequest = {
  repo: RepoSlug;
  number: number;
  title: string;
  state: PullRequestState;
  isMerged: boolean;
  htmlUrl: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  baseSha: string;
  mergeCommitSha: string | null;
  lastCommitSha: string;
  commitShas: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  closedAt: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function main() {
  const repos = parseReposFromArgs(process.argv.slice(2));
  const token = await resolveToken();
  const headers = buildHeaders(token);
  const now = new Date().toISOString();
  const results: Record<RepoSlug, StoredPullRequest[]> = {} as Record<RepoSlug, StoredPullRequest[]>;

  for (const repo of repos) {
    console.error(`Fetching closed pull requests for ${repo}...`);
    const pulls = await fetchAllPulls(repo, headers);
    console.error(`  Found ${pulls.length} closed PRs`);
    let processed = 0;
    const detailed = await mapWithConcurrency(pulls, CONCURRENCY, async (pull, index) => {
      const [detail, commits] = await Promise.all([
        fetchPullDetail(repo, pull.number, headers),
        fetchPullCommits(repo, pull.number, headers),
      ]);
      let stored: StoredPullRequest | undefined;
      if (commits.length === 0) {
        console.error(`  Warning: PR #${pull.number} in ${repo} returned no commits; skipping`);
      } else {
        const commitShas = commits.map((item) => item.sha);
        const lastCommitSha = commitShas[commitShas.length - 1];
        stored = {
          repo,
          number: pull.number,
          title: pull.title,
          state: pull.state,
          isMerged: pull.merged_at !== null,
          htmlUrl: pull.html_url,
          headRef: pull.head.ref,
          headSha: pull.head.sha,
          baseRef: pull.base.ref,
          baseSha: pull.base.sha,
          mergeCommitSha: pull.merge_commit_sha,
          lastCommitSha,
          commitShas,
          additions: detail.additions,
          deletions: detail.deletions,
          changedFiles: detail.changed_files,
          closedAt: pull.closed_at,
          mergedAt: pull.merged_at,
          createdAt: pull.created_at,
          updatedAt: pull.updated_at,
        } satisfies StoredPullRequest;
      }
      processed += 1;
      if ((processed % 50 === 0) || processed === pulls.length || index === pulls.length - 1) {
        console.error(`  Processed ${processed}/${pulls.length} PRs for ${repo}`);
      }
      return stored;
    });
    results[repo] = detailed;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const payload = { generatedAt: now, repos: results };
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.error(`Wrote ground truth data to ${OUTPUT_FILE}`);
}

function parseReposFromArgs(args: string[]): RepoSlug[] {
  if (args.length === 0) {
    return DEFAULT_REPOS;
  }
  const repos: RepoSlug[] = [];
  for (const arg of args) {
    if (!arg.includes("/")) {
      throw new Error(`Invalid repo slug '${arg}'. Expected format 'owner/name'.`);
    }
    repos.push(arg as RepoSlug);
  }
  return repos;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "cmux-scripts",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

async function resolveToken(): Promise<string> {
  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }
  const spawned = spawn("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "inherit"] });
  const chunks: Buffer[] = [];
  for await (const chunk of spawned.stdout) {
    chunks.push(Buffer.from(chunk));
  }
  const { code } = await new Promise<{ code: number | null }>((resolvePromise) => {
    spawned.on("close", (closeCode) => resolvePromise({ code: closeCode }));
  });
  if (code !== 0) {
    throw new Error("Failed to resolve GitHub token. Set GITHUB_TOKEN env var or run 'gh auth login'.");
  }
  const token = Buffer.concat(chunks).toString("utf8").trim();
  if (!token) {
    throw new Error("GitHub token command returned empty output.");
  }
  return token;
}

async function fetchAllPulls(repo: RepoSlug, headers: Record<string, string>): Promise<PullRequestListItem[]> {
  const search = new URLSearchParams();
  search.set("state", "closed");
  search.set("per_page", PER_PAGE.toString());
  let url: string | null = buildUrl(`/repos/${repo}/pulls`, search);
  const out: PullRequestListItem[] = [];
  while (url) {
    const page: Paginated<PullRequestListItem[]> = await requestJson<PullRequestListItem[]>(url, headers);
    out.push(...page.data);
    url = page.next;
  }
  return out;
}

async function fetchPullDetail(repo: RepoSlug, number: number, headers: Record<string, string>): Promise<PullRequestDetail> {
  const url = buildUrl(`/repos/${repo}/pulls/${number}`);
  const { data } = await requestJson<PullRequestDetail>(url, headers);
  return data;
}

async function fetchPullCommits(repo: RepoSlug, number: number, headers: Record<string, string>): Promise<PullRequestCommit[]> {
  const search = new URLSearchParams();
  search.set("per_page", PER_PAGE.toString());
  let url: string | null = buildUrl(`/repos/${repo}/pulls/${number}/commits`, search);
  const commits: PullRequestCommit[] = [];
  while (url) {
    const page: Paginated<PullRequestCommit[]> = await requestJson<PullRequestCommit[]>(url, headers);
    commits.push(...page.data);
    url = page.next;
  }
  return commits;
}

type ParsedLink = {
  next: string | null;
};

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U | undefined>,
): Promise<U[]> {
  if (items.length === 0) {
    return [];
  }
  const max = Math.max(1, Math.min(limit, items.length));
  const results: (U | undefined)[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      if (current >= items.length) {
        break;
      }
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: max }, () => worker());
  await Promise.all(workers);
  return results.filter((value): value is U => value !== undefined);
}

async function requestJson<T>(endpoint: string, headers: Record<string, string>): Promise<Paginated<T>> {
  const url = endpoint.startsWith("http") ? endpoint : buildUrl(endpoint);
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed (${response.status} ${response.statusText}): ${text}`);
  }
  const json = (await response.json()) as T;
  const linkHeader = response.headers.get("link");
  const parsed = parseLinkHeader(linkHeader);
  return { data: json, next: parsed.next };
}

function buildUrl(path: string, params?: URLSearchParams): string {
  const cleanedPath = path.startsWith("http") ? path : `${API_ROOT}${path}`;
  const url = new URL(cleanedPath);
  if (params) {
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

function parseLinkHeader(header: string | null): ParsedLink {
  if (!header) {
    return { next: null };
  }
  const parts = header.split(",");
  let next: string | null = null;
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const [, url, rel] = match;
      if (rel === "next") {
        next = url;
      }
    }
  }
  return { next };
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
