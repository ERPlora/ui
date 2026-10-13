/**
 * `useCommand(op, { optimistic })`: runs a command operation through the API.
 *
 * With `optimistic`, each listed query gets an overlay on every active subscription (any params)
 * the moment `run` is called. On error the overlays are rolled back and `error` is set (the
 * promise rejects too); on success they are settled and fall when the server's newer result
 * arrives, which always wins. Keep it for short, non-fiscal actions (add a line, a quantity, a
 * note); numbering and fiscal data are always the server's.
 */
import { type Ref, shallowRef } from "vue";
import { ApiError } from "./errors";
import { type LiveClient, useLiveClient } from "./live-client";
import type { InputArgs, InputOf, OpName, OutputOf } from "./operations";

/**
 * One updater per affected query. `current` is `undefined` until the subscription's first result;
 * returning `undefined` lays no overlay on that subscription.
 */
export type OptimisticUpdates<Op extends OpName> = {
  [Q in OpName]?: (current: OutputOf<Q> | undefined, input: InputOf<Op>) => OutputOf<Q> | undefined;
};

export interface UseCommandOptions<Op extends OpName> {
  optimistic?: OptimisticUpdates<Op>;
  /** Explicit client (outside components or in tests); injected with `useLiveClient()` otherwise. */
  client?: LiveClient;
}

export interface UseCommand<Op extends OpName> {
  run(...args: InputArgs<Op>): Promise<OutputOf<Op>>;
  /** True while any run of this command is in flight. */
  pending: Readonly<Ref<boolean>>;
  /** Error of the last failed run; cleared when a new run starts. */
  error: Ref<ApiError | null>;
}

type AnyUpdate = (current: unknown, input: unknown) => unknown;

let overlaySeq = 0;

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(0, "client_error", err instanceof Error ? err.message : String(err));
}

export function useCommand<Op extends OpName>(op: Op, options: UseCommandOptions<Op> = {}): UseCommand<Op> {
  const client = options.client ?? useLiveClient();
  const pending = shallowRef(false);
  const error = shallowRef<ApiError | null>(null);
  let inFlight = 0;

  async function run(...args: InputArgs<Op>): Promise<OutputOf<Op>> {
    const input: unknown = args[0];
    const overlayId = `${op}#${++overlaySeq}`;
    const updates = Object.entries(options.optimistic ?? {}) as Array<[string, AnyUpdate | undefined]>;
    for (const [query, update] of updates) {
      if (!update) continue;
      for (const sub of client.stream.subscriptions(query)) {
        client.optimistic.apply(sub.id, overlayId, (current) => update(current, input));
      }
    }
    inFlight++;
    pending.value = true;
    error.value = null;
    try {
      const output = await client.api.call(op, ...args);
      client.optimistic.settle(overlayId);
      return output;
    } catch (err) {
      client.optimistic.rollback(overlayId);
      error.value = toApiError(err);
      throw err;
    } finally {
      inFlight--;
      pending.value = inFlight > 0;
    }
  }

  return { run, pending, error };
}
