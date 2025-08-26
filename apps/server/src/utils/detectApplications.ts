import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";

const execAsync = promisify(exec);

export interface AvailableApplication {
  id: string;
  name: string;
  type: "editor" | "terminal" | "ide";
  available: boolean;
  path?: string;
}

async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCommand = os.platform() === "win32" ? `where ${command}` : `which ${command}`;
    await execAsync(checkCommand);
    return true;
  } catch {
    return false;
  }
}

async function macAppExists(appName: string): Promise<string | null> {
  if (os.platform() !== "darwin") return null;
  
  const appPaths = [
    `/Applications/${appName}.app`,
    `${os.homedir()}/Applications/${appName}.app`,
    `/System/Applications/${appName}.app`,
  ];
  
  for (const appPath of appPaths) {
    try {
      await fs.access(appPath);
      return appPath;
    } catch {
      continue;
    }
  }
  
  return null;
}

export async function detectAvailableApplications(): Promise<AvailableApplication[]> {
  const applications: AvailableApplication[] = [];
  const platform = os.platform();
  
  // Existing editors (keep these for compatibility)
  applications.push({
    id: "vscode",
    name: "VS Code", 
    type: "editor",
    available: await commandExists("code"),
  });
  
  applications.push({
    id: "cursor",
    name: "Cursor",
    type: "editor",
    available: await commandExists("cursor"),
  });
  
  applications.push({
    id: "windsurf",
    name: "Windsurf",
    type: "editor",
    available: await commandExists("windsurf"),
  });
  
  // Terminal applications
  if (platform === "darwin") {
    // macOS terminals
    const terminalPath = await macAppExists("Terminal");
    applications.push({
      id: "terminal",
      name: "Terminal",
      type: "terminal",
      available: terminalPath !== null,
      path: terminalPath || undefined,
    });
    
    const itermPath = await macAppExists("iTerm");
    applications.push({
      id: "iterm",
      name: "iTerm",
      type: "terminal",
      available: itermPath !== null,
      path: itermPath || undefined,
    });
    
    const ghosttyPath = await macAppExists("Ghostty");
    applications.push({
      id: "ghostty",
      name: "Ghostty",
      type: "terminal",
      available: ghosttyPath !== null,
      path: ghosttyPath || undefined,
    });
    
    const alacrittyPath = await macAppExists("Alacritty");
    applications.push({
      id: "alacritty",
      name: "Alacritty",
      type: "terminal",
      available: alacrittyPath !== null,
      path: alacrittyPath || undefined,
    });
    
    // Xcode
    const xcodePath = await macAppExists("Xcode");
    applications.push({
      id: "xcode",
      name: "Xcode",
      type: "ide",
      available: xcodePath !== null,
      path: xcodePath || undefined,
    });
    
    // Finder (always available on macOS)
    applications.push({
      id: "finder",
      name: "Finder",
      type: "editor",
      available: true,
    });
  } else if (platform === "linux") {
    // Linux terminals
    applications.push({
      id: "gnome-terminal",
      name: "GNOME Terminal",
      type: "terminal",
      available: await commandExists("gnome-terminal"),
    });
    
    applications.push({
      id: "konsole",
      name: "Konsole",
      type: "terminal",
      available: await commandExists("konsole"),
    });
    
    applications.push({
      id: "xterm",
      name: "XTerm",
      type: "terminal",
      available: await commandExists("xterm"),
    });
    
    applications.push({
      id: "alacritty",
      name: "Alacritty",
      type: "terminal",
      available: await commandExists("alacritty"),
    });
  } else if (platform === "win32") {
    // Windows terminals
    applications.push({
      id: "cmd",
      name: "Command Prompt",
      type: "terminal",
      available: true,
    });
    
    applications.push({
      id: "powershell",
      name: "PowerShell",
      type: "terminal",
      available: await commandExists("powershell"),
    });
    
    applications.push({
      id: "wt",
      name: "Windows Terminal",
      type: "terminal",
      available: await commandExists("wt"),
    });
  }
  
  return applications;
}

export async function openWithApplication(
  appId: string,
  targetPath: string
): Promise<void> {
  const platform = os.platform();
  let command: string;
  
  if (platform === "darwin") {
    switch (appId) {
      case "vscode":
        command = `code "${targetPath}"`;
        break;
      case "cursor":
        command = `cursor "${targetPath}"`;
        break;
      case "windsurf":
        command = `windsurf "${targetPath}"`;
        break;
      case "finder":
        command = `open "${targetPath}"`;
        break;
      case "terminal":
        command = `open -a Terminal "${targetPath}"`;
        break;
      case "iterm":
        command = `open -a iTerm "${targetPath}"`;
        break;
      case "ghostty":
        command = `open -a Ghostty "${targetPath}"`;
        break;
      case "alacritty":
        command = `open -a Alacritty --args --working-directory "${targetPath}"`;
        break;
      case "xcode":
        command = `open -a Xcode "${targetPath}"`;
        break;
      default:
        throw new Error(`Unknown application: ${appId}`);
    }
  } else if (platform === "linux") {
    switch (appId) {
      case "vscode":
        command = `code "${targetPath}"`;
        break;
      case "cursor":
        command = `cursor "${targetPath}"`;
        break;
      case "windsurf":
        command = `windsurf "${targetPath}"`;
        break;
      case "gnome-terminal":
        command = `gnome-terminal --working-directory="${targetPath}"`;
        break;
      case "konsole":
        command = `konsole --workdir "${targetPath}"`;
        break;
      case "xterm":
        command = `xterm -e "cd '${targetPath}' && bash"`;
        break;
      case "alacritty":
        command = `alacritty --working-directory "${targetPath}"`;
        break;
      default:
        throw new Error(`Unknown application: ${appId}`);
    }
  } else if (platform === "win32") {
    switch (appId) {
      case "vscode":
        command = `code "${targetPath}"`;
        break;
      case "cursor":
        command = `cursor "${targetPath}"`;
        break;
      case "windsurf":
        command = `windsurf "${targetPath}"`;
        break;
      case "cmd":
        command = `start cmd /K "cd /d ${targetPath}"`;
        break;
      case "powershell":
        command = `start powershell -NoExit -Command "cd '${targetPath}'"`;
        break;
      case "wt":
        command = `wt -d "${targetPath}"`;
        break;
      default:
        throw new Error(`Unknown application: ${appId}`);
    }
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  await execAsync(command);
}