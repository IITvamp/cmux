import { AGENT_CONFIGS } from "@cmux/shared";
import { exec } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ProviderStatus {
  name: string;
  isAvailable: boolean;
  missingRequirements?: string[];
  dockerStatus?: {
    isRunning: boolean;
    version?: string;
    error?: string;
  };
  gitStatus?: {
    isAvailable: boolean;
    version?: string;
    remoteAccess?: boolean;
    error?: string;
  };
}

async function checkDockerStatus(): Promise<ProviderStatus["dockerStatus"]> {
  try {
    // Check if Docker is running
    const { stdout: versionOutput } = await execAsync(
      "docker version --format '{{.Server.Version}}'"
    );
    const version = versionOutput.trim();

    // Check if Docker daemon is accessible
    await execAsync("docker ps");

    return {
      isRunning: true,
      version,
    };
  } catch (error) {
    return {
      isRunning: false,
      error:
        error instanceof Error
          ? error.message
          : "Docker is not running or not installed",
    };
  }
}

async function checkGitStatus(): Promise<ProviderStatus["gitStatus"]> {
  try {
    // Check if git is installed
    const { stdout: versionOutput } = await execAsync("git --version");
    const version = versionOutput.trim().replace("git version ", "");

    // Check if we can reach common git remotes
    let remoteAccess = false;
    try {
      await execAsync("git ls-remote https://github.com/git/git.git HEAD", {
        timeout: 5000,
      });
      remoteAccess = true;
    } catch {
      // Network might be restricted
    }

    return {
      isAvailable: true,
      version,
      remoteAccess,
    };
  } catch (error) {
    return {
      isAvailable: false,
      error: error instanceof Error ? error.message : "Git is not installed",
    };
  }
}

async function checkClaudeRequirements(): Promise<string[]> {
  const missing: string[] = [];

  try {
    // Check for .claude.json
    await access(join(homedir(), ".claude.json"));
  } catch {
    missing.push(".claude.json file");
  }

  try {
    // Check for credentials
    const hasCredentialsFile = await access(
      join(homedir(), ".claude", ".credentials.json")
    )
      .then(() => true)
      .catch(() => false);

    if (!hasCredentialsFile) {
      // Check for API key in keychain
      try {
        await execAsync(
          "security find-generic-password -a $USER -w -s 'Claude Code'"
        );
      } catch {
        missing.push(
          "Claude credentials (no .credentials.json or API key in keychain)"
        );
      }
    }
  } catch {
    missing.push("Claude credentials");
  }

  return missing;
}

async function checkGeminiRequirements(): Promise<string[]> {
  const missing: string[] = [];
  const geminiDir = join(homedir(), ".gemini");

  try {
    // Check for settings.json (required)
    await access(join(geminiDir, "settings.json"));
  } catch {
    missing.push(".gemini/settings.json file");
  }

  // Check for authentication files
  const authFiles = [
    "oauth_creds.json",
    "google_accounts.json",
    "google_account_id",
  ];

  let hasAuth = false;
  for (const file of authFiles) {
    try {
      await access(join(geminiDir, file));
      hasAuth = true;
    } catch {
      // Continue checking
    }
  }

  if (!hasAuth) {
    // Also check for GEMINI_API_KEY in .env files
    const envPaths = [join(geminiDir, ".env"), join(homedir(), ".env")];
    let hasApiKey = false;

    for (const envPath of envPaths) {
      try {
        const content = await readFile(envPath, "utf-8");
        if (content.includes("GEMINI_API_KEY=")) {
          hasApiKey = true;
          break;
        }
      } catch {
        // Continue checking
      }
    }

    if (!hasApiKey) {
      missing.push("Gemini authentication (no OAuth or API key found)");
    }
  }

  return missing;
}

async function checkOpenAIRequirements(): Promise<string[]> {
  const missing: string[] = [];

  // Check for .codex/auth.json (required for Codex CLI)
  try {
    await access(join(homedir(), ".codex", "auth.json"));
  } catch {
    missing.push(".codex/auth.json file");
  }

  // Check for .codex/config.json
  try {
    await access(join(homedir(), ".codex", "config.json"));
  } catch {
    missing.push(".codex/config.json file");
  }

  return missing;
}

async function checkAmpRequirements(): Promise<string[]> {
  const missing: string[] = [];

  // Note: .config/amp/settings.json is optional - AMP creates a default if missing

  // Check for .local/share/amp/secrets.json (contains API key)
  const hasSecretsFile = await access(
    join(homedir(), ".local", "share", "amp", "secrets.json")
  )
    .then(() => true)
    .catch(() => false);

  // Also check for AMP_API_KEY environment variable
  if (!hasSecretsFile && !process.env.AMP_API_KEY) {
    missing.push("AMP API key (no secrets.json or AMP_API_KEY env var)");
  }

  return missing;
}

async function checkOpencodeRequirements(): Promise<string[]> {
  const missing: string[] = [];

  try {
    // Check for auth.json
    await access(join(homedir(), ".local", "share", "opencode", "auth.json"));
  } catch {
    missing.push(".local/share/opencode/auth.json file");
  }

  return missing;
}

export async function checkAllProvidersStatus(): Promise<{
  providers: ProviderStatus[];
  dockerStatus: ProviderStatus["dockerStatus"];
  gitStatus: ProviderStatus["gitStatus"];
}> {
  // Check Docker and Git status once
  const [dockerStatus, gitStatus] = await Promise.all([
    checkDockerStatus(),
    checkGitStatus(),
  ]);

  // Check each provider's specific requirements
  const providerChecks = await Promise.all(
    AGENT_CONFIGS.map(async (agent) => {
      let missingRequirements: string[] = [];

      if (agent.name.startsWith("claude-")) {
        missingRequirements = await checkClaudeRequirements();
      } else if (agent.name.startsWith("gemini-")) {
        missingRequirements = await checkGeminiRequirements();
      } else if (agent.name.startsWith("codex-")) {
        missingRequirements = await checkOpenAIRequirements();
      } else if (agent.name === "amp") {
        missingRequirements = await checkAmpRequirements();
      } else if (agent.name.startsWith("opencode-")) {
        missingRequirements = await checkOpencodeRequirements();
      }

      return {
        name: agent.name,
        isAvailable: missingRequirements.length === 0,
        missingRequirements:
          missingRequirements.length > 0 ? missingRequirements : undefined,
      };
    })
  );

  return {
    providers: providerChecks,
    dockerStatus,
    gitStatus,
  };
}
