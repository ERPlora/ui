// A file the API answers as an attachment (an invoice's PDF, a list's CSV), which `api.call` cannot read as JSON. It
// comes back only when the answer IS that file (its `Content-Type`): an API error, a proxy's page or JSON with a 200
// rejects with the API's error instead, so a 503 is never saved as `pdf.json`. No answer, or a file cut halfway,
// rejects with `network_error` (status 0) like `api.call`. Saving the file is the page's job.
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

function lostConnection(err: unknown): ApiError {
  const reason = err instanceof Error ? err.message : String(err);
  return new ApiError(0, "network_error", sdkMessage("network"), undefined, { reason });
}
