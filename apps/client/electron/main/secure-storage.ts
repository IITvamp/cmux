import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

interface AuthTokens {
  refreshToken: string;
  accessToken: string;
  refreshTokenExpiresAt: Date;
  accessTokenExpiresAt: Date;
}

const STORAGE_FILE = "auth-tokens.enc";

function getStoragePath(): string {
  return path.join(app.getPath("userData"), STORAGE_FILE);
}

export async function storeAuthTokens(tokens: AuthTokens): Promise<void> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage encryption is not available");
    }

    const data = JSON.stringify(tokens);
    const encrypted = safeStorage.encryptString(data);
    const filePath = getStoragePath();

    await fs.writeFile(filePath, encrypted);
  } catch (error) {
    console.error("Failed to store auth tokens:", error);
    throw error;
  }
}

export async function getAuthTokens(): Promise<AuthTokens | null> {
  try {
    const filePath = getStoragePath();

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return null; // File doesn't exist
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage encryption is not available");
    }

    const encrypted = await fs.readFile(filePath);
    const decrypted = safeStorage.decryptString(encrypted);
    const tokens = JSON.parse(decrypted) as AuthTokens;

    // Check if tokens are expired
    const now = Math.floor(Date.now() / 1000);
    if (tokens.refreshExp <= now && tokens.accessExp <= now) {
      // Both tokens expired, remove storage
      await clearAuthTokens();
      return null;
    }

    return tokens;
  } catch (error) {
    console.error("Failed to retrieve auth tokens:", error);
    return null;
  }
}

export async function clearAuthTokens(): Promise<void> {
  try {
    const filePath = getStoragePath();
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to clear auth tokens:", error);
    }
  }
}

export async function hasValidTokens(): Promise<boolean> {
  const tokens = await getAuthTokens();
  return tokens !== null;
}