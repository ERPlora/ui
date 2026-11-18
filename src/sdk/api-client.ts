// `call(op, input)` finds the operation's route in the generated map and sends the input the way ninja expects it:
// the query string for a GET, the JSON body otherwise, `{param}` placeholders filled from the input. A failure
// rejects with an `ApiError`, and a programming error (unknown operation, missing path parameter) with a plain `Error`.
// Plain `fetch` rather than `openapi-fetch`, whose typing is keyed by path and method while the SDK's is by operation.
import { ApiError, parseErrorEnvelope } from "./errors";
import type { HeaderProvider } from "./headers";
import { sdkMessage } from "./messages";
import type { InputArgs, OperationRoutes, OpName, OutputOf } from "./operations";

export interface ApiClientOptions {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  headers: Pick<HeaderProvider, "apiHeaders">;
  /** API root, e.g. `/api`. Route paths already under it are used as they are. */
  apiBase: string;
  routes: OperationRoutes;
  /** Sees every `ApiError` a call rejects with, before the caller (a host that no longer serves the app). */
  onError?: (error: ApiError) => void;
}

export interface ApiClient {
  call<Op extends OpName>(op: Op, ...args: InputArgs<Op>): Promise<OutputOf<Op>>;
}

const PLACEHOLDER = /\{([^{}]+)\}/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function joinBase(apiBase: string, path: string): string {
  const base = apiBase.replace(/\/+$/, "");
  if (base === "" || path === base || path.startsWith(`${base}/`)) return path;
  return `${base}${path}`;
}

function scalar(name: string, value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  throw new TypeError(`query parameter "${name}" must be a scalar or an array of scalars`);
}

function queryString(members: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(members)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) search.append(name, scalar(name, item));
    }
  }
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}

/** Fills `{param}` from the input; returns the path and the members left for query or body. */
function fillPath(op: string, path: string, input: unknown): { path: string; rest: unknown } {
  const names = [...path.matchAll(PLACEHOLDER)].map((m) => m[1]);
  if (names.length === 0) return { path, rest: input };
  if (!isPlainObject(input)) throw new TypeError(`operation "${op}" needs an object input for its path parameters`);
  const rest: Record<string, unknown> = { ...input };
  const filled = path.replace(PLACEHOLDER, (_match, name: string) => {
    const value = input[name];
    if (value === undefined || value === null || value === "") {
      throw new TypeError(`operation "${op}" is missing the path parameter "${name}"`);
    }
    delete rest[name];
    return encodeURIComponent(scalar(name, value));
  });
  return { path: filled, rest };
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204 || res.status === 205) return undefined;
  const text = await res.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw parseErrorEnvelope(res.status, text);
  }
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  async function call(op: string, input: unknown): Promise<unknown> {
    const route = opts.routes[op];
    if (!route) throw new Error(`api: unknown operation "${op}" (not in the generated route map)`);
    const method = route.method.toUpperCase();
    const { path, rest } = fillPath(op, joinBase(opts.apiBase, route.path), input);
    const headers: Record<string, string> = { ...opts.headers.apiHeaders(method), Accept: "application/json" };
    let url = path;
    let body: string | undefined;
    if (route.method === "get") {
      if (rest !== undefined && !isPlainObject(rest)) throw new TypeError(`operation "${op}": a query input must be an object`);
      url += rest === undefined ? "" : queryString(rest);
    } else {
      const empty = rest === undefined || (isPlainObject(rest) && Object.keys(rest).length === 0);
      if (!(empty && route.method === "delete") && rest !== undefined) {
        body = JSON.stringify(rest);
        headers["Content-Type"] = "application/json";
      }
    }
    let res: Response;
    try {
      res = await opts.fetchImpl(url, { method, headers, body, credentials: "same-origin" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ApiError(0, "network_error", sdkMessage("network"), undefined, { reason });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => undefined);
      throw parseErrorEnvelope(res.status, text);
    }
    return readBody(res);
  }

  async function reported(op: string, input: unknown): Promise<unknown> {
    try {
      return await call(op, input);
    } catch (err) {
      if (err instanceof ApiError) opts.onError?.(err);
      throw err;
    }
  }

  return {
    call: <Op extends OpName>(op: Op, ...args: InputArgs<Op>) => reported(op, args[0]) as Promise<OutputOf<Op>>,
  };
}
