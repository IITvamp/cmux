import type { DataModel } from "@cmux/convex/dataModel";
import { zid } from "convex-helpers/server/zod";

export function typedZid<T extends keyof DataModel>(tableName: T) {
  return zid(tableName);
}
