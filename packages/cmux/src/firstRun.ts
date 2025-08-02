import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import inquirer from "inquirer";
import {
  detectInstalledEditors,
  readEditorSettings,
  saveSettingsForRemote,
  type EditorConfig,
} from "./vscodeSettings.js";
import { logger } from "./logger.js";

export async function isFirstRun(cmuxDir: string): Promise<boolean> {
  const configPath = path.join(cmuxDir, ".cmux-config.json");
  return !existsSync(configPath);
}

export interface CmuxConfig {
  firstRunCompleted: boolean;
  editorSettingsCopied?: boolean;
  selectedEditor?: string;
}

export async function loadConfig(cmuxDir: string): Promise<CmuxConfig> {
  const configPath = path.join(cmuxDir, ".cmux-config.json");
  
  if (!existsSync(configPath)) {
    return { firstRunCompleted: false };
  }

  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    await logger.error(`Failed to load config: ${error}`);
    return { firstRunCompleted: false };
  }
}

export async function saveConfig(cmuxDir: string, config: CmuxConfig): Promise<void> {
  const configPath = path.join(cmuxDir, ".cmux-config.json");
  await fs.mkdir(cmuxDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function handleFirstRun(cmuxDir: string): Promise<void> {
  console.log("\n🎉 Welcome to cmux! This appears to be your first run.");
  
  const installedEditors = await detectInstalledEditors();
  
  if (installedEditors.length === 0) {
    console.log("\n📝 No VS Code-based editors detected. Skipping settings import.");
    await saveConfig(cmuxDir, { firstRunCompleted: true });
    return;
  }

  console.log("\n🔍 Detected the following editors:");
  installedEditors.forEach(editor => {
    console.log(`  - ${editor.displayName}`);
  });

  const { shouldCopySettings } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldCopySettings",
      message: "Would you like to copy settings and extensions from one of these editors?",
      default: true,
    },
  ]);

  if (!shouldCopySettings) {
    await saveConfig(cmuxDir, { firstRunCompleted: true });
    return;
  }

  const choices = installedEditors.map(editor => ({
    name: editor.displayName,
    value: editor,
  }));

  const { selectedEditor } = await inquirer.prompt<{ selectedEditor: EditorConfig }>([
    {
      type: "list",
      name: "selectedEditor",
      message: "Which editor would you like to copy settings from?",
      choices,
    },
  ]);

  console.log(`\n📋 Reading settings from ${selectedEditor.displayName}...`);
  
  try {
    const settings = await readEditorSettings(selectedEditor);
    const settingsDir = path.join(cmuxDir, "vscode-settings");
    
    await saveSettingsForRemote(settings, settingsDir);
    
    console.log("\n✅ Settings copied successfully!");
    console.log(`   📁 Saved to: ${settingsDir}`);
    
    if (settings.settings) {
      console.log(`   ⚙️  Settings: ✓`);
    }
    if (settings.keybindings && settings.keybindings.length > 0) {
      console.log(`   ⌨️  Keybindings: ✓`);
    }
    if (settings.extensions && settings.extensions.length > 0) {
      console.log(`   🧩 Extensions: ${settings.extensions.length} found`);
    }
    if (settings.snippets && Object.keys(settings.snippets).length > 0) {
      console.log(`   📝 Snippets: ${Object.keys(settings.snippets).length} files`);
    }

    await saveConfig(cmuxDir, {
      firstRunCompleted: true,
      editorSettingsCopied: true,
      selectedEditor: selectedEditor.type,
    });

    console.log("\n💡 These settings will be automatically applied to remote VS Code instances.");
  } catch (error) {
    await logger.error(`Failed to copy settings: ${error}`);
    console.error(`\n❌ Failed to copy settings: ${error}`);
    await saveConfig(cmuxDir, { firstRunCompleted: true });
  }
}