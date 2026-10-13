// Public entry of the SDK (`@erplora/ui/sdk`): transport, typed API client, optimistic overlays
// and the Vue composables. Projects augment `Operations` here from their generated OpenAPI types.
export {
  ALLAUTH_BROWSER_BASE,
  createAllauthClient,
  isReauthenticationRequired,
  ReauthenticationRequiredError,
  type AllauthClient,
  type AllauthDeps,
  type AllauthFlow,
  type AllauthUser,
  type Authenticator,
  type AuthState,
  type RecoveryCodes,
  type TotpSetup,
  type TotpStatus,
} from "./allauth";
export { createApiClient, type ApiClient, type ApiClientOptions } from "./api-client";
export { backoffDelay, DEFAULT_RETRY_MS, MAX_BACKOFF_MS } from "./backoff";
export { readSpaConfig, SPA_CONFIG_ELEMENT_ID, SpaConfigError, type SpaConfig } from "./config";
export {
  ApiError,
  fieldErrors,
  isConflict,
  isUnauthorized,
  LIVE_ERROR_STATUS,
  parseErrorEnvelope,
  type FieldErrors,
} from "./errors";
export {
  CLIENT_INSTANCE_HEADER,
  createHeaderProvider,
  DEVICE_ID_HEADER,
  ELEVATION_TOKEN_HEADER,
  readCookie,
  type HeaderConfig,
  type HeaderDeps,
  type HeaderProvider,
} from "./headers";
export {
  createLiveClient,
  LIVE_CLIENT_KEY,
  provideLiveClient,
  useLiveClient,
  type BrowserDeps,
  type LiveClient,
} from "./live-client";
export {
  HTTP_METHODS,
  isQueryRoute,
  parseOperationRoutes,
  type HttpMethod,
  type InputArgs,
  type InputOf,
  type OperationRoute,
  type OperationRoutes,
  type Operations,
  type OpName,
  type OutputOf,
} from "./operations";
export {
  createOptimisticStore,
  SETTLE_TIMEOUT_MS,
  type OptimisticStore,
  type OptimisticStoreOptions,
  type Overlay,
} from "./optimistic";
export { createSseParser, type SseFrame, type SseParser } from "./sse-parser";
export {
  createStreamManager,
  HIDDEN_CLOSE_MS,
  RESUBSCRIBE_DEBOUNCE_MS,
  WATCHDOG_MS,
  type ActiveSubscription,
  type LiveSubscription,
  type StreamManager,
  type StreamManagerOptions,
  type StreamStatus,
  type SubEvent,
  type SubListener,
  type Unsubscribe,
} from "./stream-manager";
export {
  encodeSubscriptions,
  MAX_QUERY_BYTES,
  MAX_SUBSCRIPTIONS,
  stableJson,
  type WireSubscription,
} from "./subscriptions";
export { useCommand, type OptimisticUpdates, type UseCommand, type UseCommandOptions } from "./use-command";
export { RELEASE_GRACE_MS, useLive, type LiveStatus, type UseLive, type UseLiveOptions } from "./use-live";
