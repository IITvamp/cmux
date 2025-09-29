import { Buffer } from "node:buffer";
import { exec as childExec } from "node:child_process";
import { promisify } from "node:util";

export const WORKSPACE_ROOT = process.env.CMUX_WORKSPACE_PATH || "/root/workspace";

export const execAsync = promisify(childExec);

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function toUtf8String(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}
