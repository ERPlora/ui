/**
 * `useLive(op, params)`: the live result of a query operation, kept up to date by the tab's stream.
 *
 * - Subscribes when the component mounts (at once outside a component, e.g. in an effect scope).
 * - `params` may be a value, a ref or a getter; a change of content (deep) re-subscribes. The old
 *   data stays visible, with `status` `loading`, until the new result arrives.
 * - In an Ionic page, `ionViewDidLeave` and unmounting release the subscription after a 2 s grace,
 *   so a quick back-navigation reuses it without reopening the stream; `ionViewWillEnter`
 *   resumes. The data is never cleared while away.
 * - `data` is the server result with the optimistic overlays of `useCommand` applied.
 * - `status`: `reconnecting` while the stream recovers, `error` after an error frame (data kept),
 *   `loading` until the first result of the current params, then `live`.
 */
import { onIonViewDidLeave, onIonViewWillEnter } from "@ionic/vue";
import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  type MaybeRefOrGetter,
  onMounted,
  onScopeDispose,
  type Ref,
  shallowRef,
  toValue,
  watch,
} from "vue";
import type { ApiError } from "./errors";
import { type LiveClient, useLiveClient } from "./live-client";
import type { InputOf, OpName, OutputOf } from "./operations";
import type { LiveSubscription, StreamStatus, SubEvent } from "./stream-manager";
import { stableJson } from "./subscriptions";

export const RELEASE_GRACE_MS = 2000;

export type LiveStatus = "loading" | "live" | "error" | "reconnecting";

export interface UseLiveOptions {
  /** Explicit client (outside components or in tests); injected with `useLiveClient()` otherwise. */
  client?: LiveClient;
}

export interface UseLive<T> {
  data: Readonly<Ref<T | undefined>>;
  status: Readonly<Ref<LiveStatus>>;
  error: Readonly<Ref<ApiError | null>>;
  /** Reopens the stream so the server runs every query again. */
  refresh(): void;
}

type LiveArgs<Op extends OpName> = undefined extends InputOf<Op>
  ? [params?: MaybeRefOrGetter<InputOf<Op>>, options?: UseLiveOptions]
  : [params: MaybeRefOrGetter<InputOf<Op>>, options?: UseLiveOptions];

interface Attachment {
  key: string;
  sub?: LiveSubscription;
}

export function useLive<Op extends OpName>(op: Op, ...args: LiveArgs<Op>): UseLive<OutputOf<Op>> {
  const [params, options] = args;
  const client = options?.client ?? useLiveClient();
  const instance = getCurrentInstance();

  const serverData = shallowRef<unknown>(undefined);
  const viewId = shallowRef<string | undefined>(undefined);
  const hasResult = shallowRef(false);
  const streamStatus = shallowRef<StreamStatus>(client.stream.status());
  const error = shallowRef<ApiError | null>(null);
  const overlayVersion = shallowRef(0);

  let current: Attachment | undefined;
  let cancelRelease: (() => void) | undefined;
  let active = false;

  function onEvent(att: Attachment, event: SubEvent): void {
    if (att !== current) return;
    if (event.type === "status") {
      streamStatus.value = event.status;
    } else if (event.type === "error") {
      error.value = event.error;
    } else {
      serverData.value = event.data;
      hasResult.value = true;
      error.value = null;
      // A cached result is replayed inside `subscribe()`, before `att.sub` is set: see `subscribe`.
      if (att.sub) viewId.value = att.sub.id;
    }
  }

  function stopRelease(): void {
    cancelRelease?.();
    cancelRelease = undefined;
  }

  function subscribe(): void {
    const raw = toValue(params);
    const key = stableJson(raw);
    stopRelease();
    if (current?.key === key) return;
    const previous = current;
    const att: Attachment = { key };
    current = att;
    hasResult.value = false;
    error.value = null;
    streamStatus.value = client.stream.status();
    att.sub = client.stream.subscribe(op, raw, (event) => onEvent(att, event));
    if (hasResult.value || viewId.value === undefined) viewId.value = att.sub.id;
    // After the new one, so a subscription shared by both never drops to zero listeners.
    previous?.sub?.();
  }

  function releaseLater(): void {
    if (!current || cancelRelease) return;
    const att = current;
    cancelRelease = client.schedule(() => {
      cancelRelease = undefined;
      if (current === att) current = undefined;
      att.sub?.();
    }, RELEASE_GRACE_MS);
  }

  function start(): void {
    active = true;
    subscribe();
  }

  function stop(): void {
    active = false;
    releaseLater();
  }

  watch(
    () => stableJson(toValue(params)),
    () => {
      if (active) subscribe();
    },
  );

  const stopOverlays = client.optimistic.onChange((subId) => {
    if (subId === viewId.value) overlayVersion.value++;
  });

  if (instance) {
    onMounted(start);
    onIonViewDidLeave(stop);
    onIonViewWillEnter(() => {
      if (instance.isMounted) start();
    });
  } else {
    start();
  }
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop();
      stopOverlays();
    });
  }

  const data = computed(() => {
    void overlayVersion.value;
    const id = viewId.value;
    const server = serverData.value;
    return (id === undefined ? server : client.optimistic.view(id, server)) as OutputOf<Op> | undefined;
  });

  const status = computed<LiveStatus>(() => {
    if (streamStatus.value === "reconnecting") return "reconnecting";
    if (error.value) return "error";
    return hasResult.value ? "live" : "loading";
  });

  return { data, status, error, refresh: () => client.stream.reconnect() };
}
