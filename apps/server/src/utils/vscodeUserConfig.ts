import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

export interface VSCodeUserConfigPaths {
  userDir: string | null;
  settingsJson: string | null;
  keybindingsJson: string | null;
  snippetsDir: string | null;
}

export interface VSCodeExtensionsScanResult {
  extensionIds: string[];
}

/**
 * Resolve the user's VS Code config directory without relying on env vars.
 * Supports Code, Code - Insiders, and VSCodium on macOS, Linux, and Windows.
 */
export function findVSCodeUserConfig(): VSCodeUserConfigPaths {
  const home = os.homedir();
  const platform = os.platform();

  const candidates: string[] = [];

  if (platform === "darwin") {
    const base = path.join(home, "Library", "Application Support");
    candidates.push(
      path.join(base, "Code", "User"),
      path.join(base, "Code - Insiders", "User"),
      path.join(base, "VSCodium", "User")
    );
  } else if (platform === "linux") {
    const configBase = path.join(home, ".config");
    candidates.push(
      path.join(configBase, "Code", "User"),
      path.join(configBase, "Code - Insiders", "User"),
      path.join(configBase, "VSCodium", "User")
    );
  } else if (platform === "win32") {
    // Avoid env vars; VS Code typically stores under %APPDATA%\Code\User
    // Derive from homedir when possible
    const appData = path.join(home, "AppData", "Roaming");
    candidates.push(
      path.join(appData, "Code", "User"),
      path.join(appData, "Code - Insiders", "User"),
      path.join(appData, "VSCodium", "User")
    );
  }

  let userDir: string | null = null;
  for (const p of candidates) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        userDir = p;
        break;
      }
    } catch {
      // ignore
    }
  }

  if (!userDir) {
    return {
      userDir: null,
      settingsJson: null,
      keybindingsJson: null,
      snippetsDir: null,
    };
  }

  const settings = path.join(userDir, "settings.json");
  const keybindings = path.join(userDir, "keybindings.json");
  const snippets = path.join(userDir, "snippets");

  return {
    userDir,
    settingsJson: fs.existsSync(settings) ? settings : null,
    keybindingsJson: fs.existsSync(keybindings) ? keybindings : null,
    snippetsDir: fs.existsSync(snippets) && fs.statSync(snippets).isDirectory()
      ? snippets
      : null,
  };
}

/**
 * Scan common extension directories to produce a list of extension IDs (publisher.name).
 * Does not rely on the `code` CLI. Safe across platforms; doesn’t parse state DB.
 */
export function findInstalledVSCodeExtensionIds(): VSCodeExtensionsScanResult {
  const home = os.homedir();
  const platform = os.platform();

  const dirs: string[] = [];

  // Common extension directories
  const pushIfDir = (p: string) => {
    try {
      if (fs.statSync(p).isDirectory()) dirs.push(p);
    } catch {
      // ignore
    }
  };

  if (platform === "darwin" || platform === "linux" || platform === "win32") {
    pushIfDir(path.join(home, ".vscode", "extensions"));
    pushIfDir(path.join(home, ".vscode-insiders", "extensions"));
    pushIfDir(path.join(home, ".vscode-oss", "extensions")); // VSCodium alt
  }

  const ids = new Set<string>();

  for (const dir of dirs) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const extPath = path.join(dir, entry);
      try {
        const pkgJson = path.join(extPath, "package.json");
        if (!fs.existsSync(pkgJson)) continue;
        const text = fs.readFileSync(pkgJson, "utf8");
        const pkg = JSON.parse(text) as { publisher?: string; name?: string };
        if (pkg.publisher && pkg.name) {
          const id = `${pkg.publisher}.${pkg.name}`;
          ids.add(id);
        }
      } catch {
        // ignore broken extension folders
      }
    }
  }

  return { extensionIds: Array.from(ids.values()).sort() };
}
