import { exec as childExec, execFile as childExecFile } from "node:child_process";
import { promisify } from "node:util";

export const WORKSPACE_ROOT =
  process.env.CMUX_WORKSPACE_PATH || "/root/workspace";

export const execAsync = promisify(childExec);
export const execFileAsync = promisify(childExecFile);
