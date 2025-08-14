import type { DataModel, Id } from "@cmux/convex/dataModel";
import { z } from "zod";

// Minimal local replacement for convex-helpers' zid
export function typedZid<T extends keyof DataModel>(_tableName: T) {
  return z.string().transform((s) => s as Id<T>);
}
