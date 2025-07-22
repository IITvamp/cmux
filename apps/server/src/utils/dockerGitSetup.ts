import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getGitHubTokenFromKeychain } from './getGitHubToken.js';

export async function setupGitCredentialsForDocker(instanceId: string): Promise<string | null> {
  try {
    const githubToken = await getGitHubTokenFromKeychain();
    if (!githubToken) {
      return null;
    }

    // Create a temporary git config file with the token
    const tempDir = path.join(os.tmpdir(), 'coderouter-git-configs');
    await fs.mkdir(tempDir, { recursive: true });
    
    const gitCredentialsPath = path.join(tempDir, `git-credentials-${instanceId}`);
    
    // Write credentials in git-credentials format
    // Format: https://username:password@host
    const credentialsContent = `https://oauth:${githubToken}@github.com\n`;
    
    await fs.writeFile(gitCredentialsPath, credentialsContent, { mode: 0o600 });
    
    return gitCredentialsPath;
  } catch (error) {
    console.error('Failed to setup git credentials:', error);
    return null;
  }
}

export async function cleanupGitCredentials(instanceId: string): Promise<void> {
  try {
    const tempDir = path.join(os.tmpdir(), 'coderouter-git-configs');
    const gitCredentialsPath = path.join(tempDir, `git-credentials-${instanceId}`);
    
    await fs.unlink(gitCredentialsPath);
  } catch {
    // File might not exist, which is fine
  }
}