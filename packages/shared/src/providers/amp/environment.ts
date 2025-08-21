import type { EnvironmentResult } from "../common/environment-result.js";

export async function getAmpEnvironment(): Promise<EnvironmentResult> {
  // These must be lazy since configs are imported into the browser
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { Buffer } = await import("node:buffer");

  const files: EnvironmentResult["files"] = [];
  const env: Record<string, string> = {};
  const startupCommands: string[] = [];

  // Ensure .config/amp and .local/share/amp directories exist
  startupCommands.push("mkdir -p ~/.config/amp");
  startupCommands.push("mkdir -p ~/.local/share/amp");

  // Transfer settings.json
  try {
    const settingsPath = `${homedir()}/.config/amp/settings.json`;
    const settingsContent = await readFile(settingsPath, "utf-8");
    
    // Validate that it's valid JSON
    JSON.parse(settingsContent);
    
    files.push({
      destinationPath: "$HOME/.config/amp/settings.json",
      contentBase64: Buffer.from(settingsContent).toString("base64"),
      mode: "644",
    });
  } catch (error) {
    console.warn("Failed to read amp settings.json:", error);
    // Create default settings if none exist
    const defaultSettings = {
      model: "anthropic/claude-3-5-sonnet-20241022",
      theme: "dark",
    };
    files.push({
      destinationPath: "$HOME/.config/amp/settings.json",
      contentBase64: Buffer.from(JSON.stringify(defaultSettings, null, 2)).toString("base64"),
      mode: "644",
    });
  }

  // Transfer secrets.json
  try {
    const secretsPath = `${homedir()}/.local/share/amp/secrets.json`;
    const secretsContent = await readFile(secretsPath, "utf-8");
    
    // Validate that it's valid JSON
    JSON.parse(secretsContent);
    
    files.push({
      destinationPath: "$HOME/.local/share/amp/secrets.json",
      contentBase64: Buffer.from(secretsContent).toString("base64"),
      mode: "600", // More restrictive permissions for secrets
    });
  } catch (error) {
    console.warn("Failed to read amp secrets.json:", error);
  }

  // Force AMP to use local proxy and encode taskRunId via CMUX env
  // The worker's proxy (listening on port 39379) will swap in the real key.
  env.AMP_URL = "http://localhost:39379";

  // Ensure AMP_API_KEY is exported in login shells with CMUX taskRunId embedded.
  // We write to multiple profiles to cover bash -lc behavior.
  const exportLine = 'export AMP_API_KEY="taskRunId:$CMUX_TASK_RUN_ID"';
  startupCommands.push(
    `grep -q "export AMP_API_KEY=\\\"taskRunId:\\$CMUX_TASK_RUN_ID\\\"" ~/.bashrc || echo '${exportLine}' >> ~/.bashrc`
  );
  startupCommands.push(
    `grep -q "export AMP_API_KEY=\\\"taskRunId:\\$CMUX_TASK_RUN_ID\\\"" ~/.bash_profile || echo '${exportLine}' >> ~/.bash_profile || true`
  );
  startupCommands.push(
    `grep -q "export AMP_API_KEY=\\\"taskRunId:\\$CMUX_TASK_RUN_ID\\\"" ~/.profile || echo '${exportLine}' >> ~/.profile || true`
  );

  return { files, env, startupCommands };
}
