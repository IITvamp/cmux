import { execWithEnv } from "./execWithEnv";

// Helper functions for common GitHub API operations
export const ghApi = {
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
