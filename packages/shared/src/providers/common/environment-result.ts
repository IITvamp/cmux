export interface EnvironmentResult {
  files: Array<{
    destinationPath: string;
    contentBase64: string;
    mode: string;
  }>;
  env: Record<string, string>;
  startupCommands: string[];
}