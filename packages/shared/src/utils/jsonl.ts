import { promises as fs } from "node:fs";

export interface JsonlReadOptions {
  trim?: boolean;
  skipEmpty?: boolean;
}

export function parseJsonSafe<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function readJsonl(
  filePath: string,
  options: JsonlReadOptions = { trim: true, skipEmpty: true }
): Promise<string[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const raw = content.split("\n");
  const out: string[] = [];
  for (const line of raw) {
    const val = options.trim ? line.trim() : line;
    if (options.skipEmpty) {
      if (val.length > 0) out.push(val);
    } else {
      out.push(val);
    }
  }
  return out;
}

export async function readJsonlObjects<T>(filePath: string): Promise<T[]> {
  const lines = await readJsonl(filePath);
  const out: T[] = [];
  for (const l of lines) {
    const obj = parseJsonSafe<T>(l);
    if (obj !== null) out.push(obj);
  }
  return out;
}

export async function getLastJsonlObject<T>(filePath: string): Promise<T | null> {
  const lines = await readJsonl(filePath);
  for (let i = lines.length - 1; i >= 0; i--) {
    const obj = parseJsonSafe<T>(lines[i] as string);
    if (obj !== null) return obj;
  }
  return null;
}

export function takeLast<T>(arr: T[], n: number): T[] {
  if (n <= 0) return [];
  if (n >= arr.length) return [...arr];
  return arr.slice(arr.length - n);
}

export async function tailJsonlObjects<T>(filePath: string, n: number): Promise<T[]> {
  const lines = await readJsonl(filePath);
  const tail = takeLast(lines, n);
  const out: T[] = [];
  for (const l of tail) {
    const obj = parseJsonSafe<T>(l);
    if (obj !== null) out.push(obj);
  }
  return out;
}

