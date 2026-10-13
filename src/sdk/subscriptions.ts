/**
 * Identity and wire encoding of live subscriptions.
 * `GET /api/live?s=<base64url(JSON [{id, op, params}])>`; base64url is unpadded (RFC 4648 §5).
 */

export interface WireSubscription {
  id: string;
  op: string;
  params: unknown;
}

export const MAX_SUBSCRIPTIONS = 50;
export const MAX_QUERY_BYTES = 12 * 1024;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** JSON with object keys sorted at every depth; `undefined` params become `{}`. */
export function stableJson(value: unknown): string {
  if (value === undefined) return "{}";
  return JSON.stringify(value, (_key, member: unknown) => {
    if (!isPlainObject(member)) return member;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(member).sort()) sorted[key] = member[key];
    return sorted;
  });
}

/** FNV-1a 32-bit over the UTF-8 bytes, as 8 lowercase hex digits. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function subscriptionId(op: string, paramsJson: string): string {
  return fnv1a(`${op}\u0000${paramsJson}`);
}

export function encodeSubscriptions(list: readonly WireSubscription[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(list));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Console warnings for a subscription list over the contract limits (the server enforces them). */
export function limitWarnings(count: number, query: string): string[] {
  const warnings: string[] = [];
  if (count > MAX_SUBSCRIPTIONS) {
    warnings.push(`live: ${count} subscriptions exceed the limit of ${MAX_SUBSCRIPTIONS}`);
  }
  if (query.length > MAX_QUERY_BYTES) {
    warnings.push(`live: the subscription list exceeds ${MAX_QUERY_BYTES / 1024} KB (${query.length} bytes)`);
  }
  return warnings;
}
