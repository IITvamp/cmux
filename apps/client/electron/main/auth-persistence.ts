import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import os from "node:os";
import { app } from "electron";

const AUTH_STATE_FILE = "stack-auth-state.json";

export interface StoredAuthTokens {
  refreshToken: string;
  refreshExpiresAt: number | null;
  accessToken: string | null;
  accessExpiresAt: number | null;
}

function authStatePath(): string {
  try {
    return join(app.getPath("userData"), AUTH_STATE_FILE);
  } catch {
    return join(os.tmpdir(), "cmux-user-data", AUTH_STATE_FILE);
  }
}

export async function readStoredAuthTokens(): Promise<StoredAuthTokens | null> {
  const file = authStatePath();
  try {
    const contents = await readFile(file, "utf8");
    const data = JSON.parse(contents) as StoredAuthTokens;
    if (typeof data.refreshToken !== "string") return null;
    return {
      refreshToken: data.refreshToken,
      refreshExpiresAt: data.refreshExpiresAt ?? null,
      accessToken: data.accessToken ?? null,
      accessExpiresAt: data.accessExpiresAt ?? null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    return null;
  }
}

export async function writeStoredAuthTokens(tokens: StoredAuthTokens): Promise<void> {
  const file = authStatePath();
  try {
    await mkdir(dirname(file), { recursive: true });
  } catch {
    // ignore mkdir errors; write may still succeed
  }
  const payload = JSON.stringify(tokens);
  try {
    await writeFile(file, payload, { encoding: "utf8" });
  } catch {
    // swallow write errors to avoid crashing auth flow
  }
}

export async function deleteStoredAuthTokens(): Promise<void> {
  const file = authStatePath();
  try {
    await rm(file, { force: true });
  } catch {
    // ignore delete failures
  }
}
