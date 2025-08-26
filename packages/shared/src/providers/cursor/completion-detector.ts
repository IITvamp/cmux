// Cursor Agent stream-JSON parsing helpers (no Node-specific APIs)

export type CursorEventType =
  | "system"
  | "user"
  | "assistant"
  | "tool_call"
  | "result";

export interface CursorBaseEvent {
  type: CursorEventType;
  subtype?: string;
  is_error?: boolean;
  session_id?: string;
  // Other fields are ignored; keep type-safe by using unknown where needed
  [key: string]: unknown;
}

export interface CursorSuccessResultEvent extends CursorBaseEvent {
  type: "result";
  subtype: "success";
  is_error: false;
  result?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseCursorEventLine(line: string): CursorBaseEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Must be a single JSON object per line
  if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (isObject(obj) && typeof obj.type === "string") {
      return obj as CursorBaseEvent;
    }
  } catch {
    // Not valid JSON; ignore
  }
  return null;
}

export function isCursorSuccessResult(event: CursorBaseEvent | null): event is CursorSuccessResultEvent {
  return (
    !!event &&
    event.type === "result" &&
    event.subtype === "success" &&
    (event as { is_error?: unknown }).is_error === false
  );
}

export default {
  parseCursorEventLine,
  isCursorSuccessResult,
};

