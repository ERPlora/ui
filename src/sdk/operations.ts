/**
 * Operations: the one path from the SPA to the server (`<app>.<entity>.<action>`).
 *
 * Types: `Operations` is empty here and each project augments it from its generated OpenAPI types:
 *
 *   declare module "@erplora/ui/sdk" {
 *     interface Operations { "demo.item.list": { input: ItemListIn; output: ItemPage } }
 *   }
 *
 * Runtime: `OperationRoutes` maps each operation to its ninja route (generated from the same
 * OpenAPI). Queries are the GET routes; every other method is a command.
 */

// Augmentation target: it must stay an interface (type aliases cannot be merged).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Operations {}

export type OpName = keyof Operations & string;

export type InputOf<Op extends OpName> = Operations[Op] extends { input: infer I } ? I : never;

export type OutputOf<Op extends OpName> = Operations[Op] extends { output: infer O } ? O : never;

/** Arguments of a call taking the input of `Op`: optional when the operation accepts no input. */
export type InputArgs<Op extends OpName> = undefined extends InputOf<Op> ? [input?: InputOf<Op>] : [input: InputOf<Op>];

export const HTTP_METHODS = ["get", "post", "patch", "put", "delete"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface OperationRoute {
  method: HttpMethod;
  /** Absolute path as in the OpenAPI document, with `{param}` placeholders. */
  path: string;
}

export type OperationRoutes = Record<string, OperationRoute>;

export function isQueryRoute(route: OperationRoute): boolean {
  return route.method === "get";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validates an untrusted op → route map (e.g. from `spa-config`) and returns a clean copy. */
export function parseOperationRoutes(raw: unknown): OperationRoutes {
  if (!isRecord(raw)) throw new TypeError("operation routes must be an object of {method, path}");
  const routes: OperationRoutes = {};
  for (const [op, route] of Object.entries(raw)) {
    if (!isRecord(route)) throw new TypeError(`operation "${op}": route must be an object of {method, path}`);
    const { method, path } = route;
    if (typeof method !== "string" || !(HTTP_METHODS as readonly string[]).includes(method)) {
      throw new TypeError(`operation "${op}": method must be one of ${HTTP_METHODS.join(", ")}`);
    }
    if (typeof path !== "string" || !path.startsWith("/")) {
      throw new TypeError(`operation "${op}": path must be an absolute path`);
    }
    routes[op] = { method: method as HttpMethod, path };
  }
  return routes;
}
