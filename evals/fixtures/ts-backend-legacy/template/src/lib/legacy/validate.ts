/**
 * Hand-rolled validation used by the controllers in src/controllers. Newer
 * routes validate with Elysia's `t` schemas instead.
 */

export type Errors = string[];

export function requireString(
  body: Record<string, unknown>,
  field: string,
  errors: Errors,
  { max = 1000 }: { max?: number } = {},
): string | undefined {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} is required`);
    return undefined;
  }
  if (value.length > max) {
    errors.push(`${field} is too long`);
    return undefined;
  }
  return value.trim();
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  errors: Errors,
): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }
  return value;
}

export function requirePositiveInt(
  body: Record<string, unknown>,
  field: string,
  errors: Errors,
): number | undefined {
  const value = body[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    errors.push(`${field} must be a positive whole number`);
    return undefined;
  }
  return value;
}

export function requireNumber(
  body: Record<string, unknown>,
  field: string,
  errors: Errors,
): number | undefined {
  const value = body[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${field} must be a number`);
    return undefined;
  }
  return value;
}

export function asBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
