/**
 * The single error envelope of the API and the live stream:
 * `{"error": {"code", "message", "fields"?}}`.
 * Errors delivered through the live stream carry `status` 0 (there is no HTTP status per frame).
 */

export type FieldErrors = Record<string, string>;

export const LIVE_ERROR_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldErrors;

  constructor(status: number, code: string, message: string, fields?: FieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (fields !== undefined) this.fields = fields;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normaliseFields(raw: unknown): FieldErrors | undefined {
  if (!isRecord(raw)) return undefined;
  const fields: FieldErrors = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "string") fields[name] = value;
    else if (Array.isArray(value)) fields[name] = value.filter((m) => typeof m === "string").join(" ");
  }
  return fields;
}

function asJson(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function parseErrorEnvelope(status: number, body: unknown): ApiError {
  const envelope = asJson(body);
  const error = isRecord(envelope) ? envelope.error : undefined;
  if (isRecord(error) && typeof error.code === "string" && typeof error.message === "string") {
    return new ApiError(status, error.code, error.message, normaliseFields(error.fields));
  }
  return new ApiError(status, "unexpected_response", `Unexpected response (HTTP ${status})`);
}

export function fieldErrors(err: unknown): FieldErrors {
  if (err instanceof ApiError && err.status === 422 && err.fields) return { ...err.fields };
  return {};
}

export function isConflict(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 409;
}

export function isUnauthorized(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401;
}
