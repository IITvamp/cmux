"use node";

import { exec } from "child_process";
import { v } from "convex/values";
import { promisify } from "util";
import { internal } from "./_generated/api.ts";
import { action } from "./_generated/server.ts";

const execAsync = promisify(exec);

// Helper to execute commands with inherited environment
const execWithEnv = (command: string) => {
  // Use zsh to ensure we get the user's shell environment and gh auth
  return execAsync(`/bin/zsh -c '${command}'`, {
    env: {
      ...process.env,
    },
  });
};

// Helper functions for common GitHub API operations
const ghApi = {
  // Execute gh api command and return parsed output
  async exec(command: string): Promise<string> {
    const { stdout } = await execWithEnv(command);
    return stdout.trim();
  },

  // Get current user
  async getUser(): Promise<string> {
    return this.exec('gh api user --jq ".login"');
  },

  // Get user repos
  async getUserRepos(): Promise<string[]> {
    const output = await this.exec(
      'gh api user/repos --paginate --jq ".[].full_name"'
    );
    return output.split("\n").filter(Boolean);
  },

  // Get user organizations
  async getUserOrgs(): Promise<string[]> {
    const output = await this.exec('gh api user/orgs --jq ".[].login"');
    return output.split("\n").filter(Boolean);
  },

  // Get organization repos
  async getOrgRepos(org: string): Promise<string[]> {
    const output = await this.exec(
      `gh api orgs/${org}/repos --paginate --jq ".[].full_name"`
    );
    return output.split("\n").filter(Boolean);
  },

  // Get repo branches
  async getRepoBranches(repo: string): Promise<string[]> {
    const output = await this.exec(
      `gh api repos/${repo}/branches --paginate --jq ".[].name"`
    );
    return output.split("\n").filter(Boolean);
  },
};

export const testGhAuth = action({
  args: {},
  handler: async () => {
    try {
      // Run all commands in parallel
      const [authStatus, whoami, home, ghConfig] = await Promise.all([
        execWithEnv("gh auth status")
          .then((r) => r.stdout)
          .catch((e) => e.message),
        execWithEnv("whoami").then((r) => r.stdout),
        execWithEnv("echo $HOME").then((r) => r.stdout),
        execWithEnv('ls -la ~/.config/gh/ || echo "No gh config"').then(
          (r) => r.stdout
        ),
      ]);

      return {
        authStatus,
        whoami,
        home,
        ghConfig,
        processEnv: {
          HOME: process.env.HOME,
          USER: process.env.USER,
          GH_TOKEN: process.env.GH_TOKEN ? "Set" : "Not set",
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "Set" : "Not set",
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        processEnv: {
          HOME: process.env.HOME,
          USER: process.env.USER,
          GH_TOKEN: process.env.GH_TOKEN ? "Set" : "Not set",
          GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "Set" : "Not set",
        },
      };
    }
  },
});

export const fetchAndStoreRepos = action({
  args: {},
  handler: async (ctx) => {
    try {
      // Fetch user info, repos, and orgs in parallel
      const [username, userRepos, orgs] = await Promise.all([
        ghApi.getUser(),
        ghApi.getUserRepos(),
        ghApi.getUserOrgs(),
      ]);

      // Fetch repos for all orgs in parallel
      const orgReposPromises = orgs.map(async (org) => ({
        org,
        repos: await ghApi.getOrgRepos(org),
      }));

      const orgReposResults = await Promise.all(orgReposPromises);

      // Combine all repos
      const allRepos: { org: string; repos: string[] }[] = [
        {
          org: username,
          repos: userRepos.filter((repo) => repo.startsWith(`${username}/`)),
        },
        ...orgReposResults,
      ];

      // Store in database
      const reposList = allRepos.flatMap((orgData) =>
        orgData.repos.map((repo) => ({
          fullName: repo,
          org: orgData.org,
          name: repo.split("/")[1],
        }))
      );

      // Clear existing repos
      const existingRepos = await ctx.runQuery(internal.github.getAllRepos);

      // Delete all existing repos in parallel
      await Promise.all(
        existingRepos.map((repo) =>
          ctx.runMutation(internal.github.deleteRepo, { id: repo._id })
        )
      );

      // Insert all new repos in parallel
      await Promise.all(
        reposList.map((repo) =>
          ctx.runMutation(internal.github.insertRepo, repo)
        )
      );

      return { success: true, count: reposList.length };
    } catch (error) {
      console.error("Error fetching repos:", error);
      throw new Error(
        `Failed to fetch GitHub repos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export const fetchBranches = action({
  args: { repo: v.string() },
  handler: async (ctx, { repo }) => {
    try {
      // Fetch branches from GitHub
      const branches = await ghApi.getRepoBranches(repo);

      // Get existing branches
      const existingBranches = await ctx.runQuery(
        internal.github.getBranchesByRepo,
        { repo }
      );

      // Delete all existing branches in parallel
      await Promise.all(
        existingBranches.map((branch) =>
          ctx.runMutation(internal.github.deleteBranch, { id: branch._id })
        )
      );

      // Insert all new branches in parallel
      await Promise.all(
        branches.map((branchName) =>
          ctx.runMutation(internal.github.insertBranch, {
            repo,
            name: branchName,
          })
        )
      );

      return { success: true, branches };
    } catch (error) {
      console.error("Error fetching branches:", error);
      throw new Error(
        `Failed to fetch branches: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
