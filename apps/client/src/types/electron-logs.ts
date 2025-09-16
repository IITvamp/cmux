export type ElectronLogSource = "userData" | "repository" | "fatal";

export interface ElectronLogFile {
  id: string;
  name: string;
  fullPath: string;
  size: number;
  modifiedAt: string;
  source: ElectronLogSource;
  truncated: boolean;
  content: string;
}

export interface CopyAllLogsResult {
  fileCount: number;
  totalBytes: number;
}
