import { v, type Validator, type Value } from "convex/values";

export const JSON_MAX_DEPTH = 6;

const jsonValidatorCache: Record<number, Validator<Value>> = {};

const primitiveJsonValidator: Validator<Value> = v.union(
  v.null(),
  v.boolean(),
  v.number(),
  v.string(),
) as unknown as Validator<Value>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, depth: number): value is Value {
  if (value === null) {
    return true;
  }
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return true;
  }

  if (depth <= 0) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, depth - 1));
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((child) => isJsonValue(child, depth - 1));
  }

  return false;
}

function jsonValueValidator(depth: number): Validator<Value> {
  const cached = jsonValidatorCache[depth];
  if (cached) {
    return cached;
  }

  if (depth <= 0) {
    jsonValidatorCache[depth] = primitiveJsonValidator;
    return primitiveJsonValidator;
  }

  const child = jsonValueValidator(depth - 1);
  const validator = v.union(
    primitiveJsonValidator,
    v.array(child),
    v.record(v.string(), child),
  ) as unknown as Validator<Value>;
  jsonValidatorCache[depth] = validator;
  return validator;
}

export const stackMetadataField = v.optional(jsonValueValidator(JSON_MAX_DEPTH));

export type StackMetadata = Value;

export function coerceStackMetadata(meta: unknown): StackMetadata | undefined {
  if (meta === undefined || meta === null) {
    return undefined;
  }
  if (isJsonValue(meta, JSON_MAX_DEPTH)) {
    return meta as StackMetadata;
  }
  return undefined;
}
