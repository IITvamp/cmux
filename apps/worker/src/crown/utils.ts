import { Buffer } from "node:buffer";

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
