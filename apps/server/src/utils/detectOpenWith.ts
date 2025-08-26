import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execAsync(`command -v ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

async function macAppExists(appName: string): Promise<boolean> {
  try {
    // -R: required app; -a: specific application by name
    await execAsync(`open -Ra "${appName}"`);
    return true;
  } catch {
    return false;
  }
}

export async function detectOpenWithCapabilities() {
  const isMac = process.platform === "darwin";

  // Common editors already supported via PATH checks
  const [hasVSCode, hasCursor, hasWindsurf] = await Promise.all([
    commandExists("code"),
    commandExists("cursor"),
    commandExists("windsurf"),
  ]);

  // Finder only on macOS
  const hasFinder = isMac;

  // Terminals
  const [hasTerminal, hasITerm, hasGhosttyCli, hasGhosttyApp, hasAlacrittyCli, hasAlacrittyApp] = await Promise.all([
    isMac ? macAppExists("Terminal") : Promise.resolve(false),
    isMac ? macAppExists("iTerm") : Promise.resolve(false),
    commandExists("ghostty"),
    isMac ? macAppExists("Ghostty") : Promise.resolve(false),
    commandExists("alacritty"),
    isMac ? macAppExists("Alacritty") : Promise.resolve(false),
  ]);

  const hasGhostty = hasGhosttyCli || hasGhosttyApp;
  const hasAlacritty = hasAlacrittyCli || hasAlacrittyApp;

  // Xcode
  const [hasXed, hasXcodeApp] = await Promise.all([
    isMac ? commandExists("xed") : Promise.resolve(false),
    isMac ? macAppExists("Xcode") : Promise.resolve(false),
  ]);
  const hasXcode = hasXed || hasXcodeApp;

  return {
    vscode: hasVSCode,
    cursor: hasCursor,
    windsurf: hasWindsurf,
    finder: hasFinder,
    terminal: hasTerminal,
    iterm: hasITerm,
    ghostty: hasGhostty,
    alacritty: hasAlacritty,
    xcode: hasXcode,
  } as const;
}

