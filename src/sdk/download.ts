/**
 * A file the API answers as an attachment (an invoice's PDF, the CSV of a list): `api.call` reads JSON only,
 * and a file needs its bytes, so the projects ask for it here and keep the network inside the SDK.
 *
 * - Asked for with its `Accept` and the session cookie (`credentials: "same-origin"`).
 * - Handed back only when the answer IS that file (its `Content-Type`, without parameters): an error of the
 *   API, a proxy's page or JSON with a 200 rejects with the API's error (`parseErrorEnvelope`), never comes
 *   back as the file (audit 2026-10-14, R-05: a link with `download` saved a 503 as `pdf.json`).
 * - A request that never got an answer, or whose file stopped coming halfway, rejects with `network_error`
 *   (status 0) and the SDK's sentence in the person's language (`sdkMessage`, hub#2281), like `api.call`; the
 *   failure's own text in `details.reason`.
 *
 * Saving it is the page's: the bytes and the name the server gave (`''` without one) come back.
 */
import { ApiError, parseErrorEnvelope } from "./errors";
import { sdkMessage } from "./messages";

/** The bytes of the file and its name from `Content-Disposition` (`''` when the server gives none). */
export interface FetchedFile {
  blob: Blob;
  name: string;
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

/** The file name of a `Content-Disposition` header (RFC 6266: `filename*` first, then `filename`); `''` without one. */
export function attachmentName(header: string | null): string {
  if (!header) return "";
  const encoded = /filename\*\s*=\s*[\w-]+'[^']*'([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"(.*)"$/, "$1"));
    } catch {
      // A malformed encoded name: the plain one, if any.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  return plain ? (plain[1] ?? plain[2] ?? "").trim() : "";
}

/** Asks for the file at `url` as `accept`; rejects with an `ApiError` when the answer is not it. */
export async function fetchFile(
  url: string,
  accept: string,
  fetchImpl: FetchImpl = (target, init) => globalThis.fetch(target, init),
): Promise<FetchedFile> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: accept }, credentials: "same-origin" });
  } catch (err) {
    throw lostConnection(err);
  }
  const type = (res.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (!res.ok || type !== accept.toLowerCase()) {
    throw parseErrorEnvelope(res.status, await res.text().catch(() => undefined));
  }
  let blob: Blob;
  try {
    blob = await res.blob();
  } catch (err) {
    // The connection dropped while the file came: the same failure as no answer at all.
    throw lostConnection(err);
  }
  return { blob, name: attachmentName(res.headers.get("Content-Disposition")) };
}

/** `network_error` (status 0) with the SDK's sentence; the failure's own text kept in `details.reason`. */
function lostConnection(err: unknown): ApiError {
  const reason = err instanceof Error ? err.message : String(err);
  return new ApiError(0, "network_error", sdkMessage("network"), undefined, { reason });
}
