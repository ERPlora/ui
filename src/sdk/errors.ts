/**
 * The single error envelope of the API and the live stream:
 * `{"error": {"code", "message", "fields"?, ...}}`.
 * Any other key of `error` (`limit` and `used` of `hubs.seat_limit`, `retry_after`…) is kept in
 * `ApiError.details`.
 * Errors delivered through the live stream carry `status` 0 (there is no HTTP status per frame).
 * A body that is not the envelope is `unexpected_response`, whose message is the SDK's sentence for a
 * person (`sdkMessage`, hub#2281): its status says which answer it was.
 */

import { sdkMessage } from "./messages";

export type FieldErrors = Record<string, string>;

/** The keys of the envelope's `error` besides `code`, `message` and `fields`; `{}` without them. */
export type ErrorDetails = Record<string, unknown>;

const ENVELOPE_KEYS = new Set(["code", "message", "fields"]);

export const LIVE_ERROR_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldErrors;
  readonly details: ErrorDetails;

  constructor(status: number, code: string, message: string, fields?: FieldErrors, details: ErrorDetails = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (fields !== undefined) this.fields = fields;
    this.details = { ...details };
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

function detailsOf(error: Record<string, unknown>): ErrorDetails {
  return Object.fromEntries(Object.entries(error).filter(([key]) => !ENVELOPE_KEYS.has(key)));
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
    return new ApiError(status, error.code, error.message, normaliseFields(error.fields), detailsOf(error));
  }
  return new ApiError(status, "unexpected_response", sdkMessage("unexpected"));
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
