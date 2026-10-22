// A file the API answers as an attachment (an invoice's PDF, the CSV of a list), asked for with the session
// cookie and its `Accept`, and handed back only when the answer IS that file: an error, a proxy's page or JSON
// is thrown as the API's error, never returned as the file (audit 2026-10-14, R-05: a 503 saved as `pdf.json`).
// A request that never got an answer says so in the person's language, like every other call of the SDK
// (hub#2281), never «Network error (Failed to fetch)».
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentName, fetchFile } from "./download";
import { ApiError } from "./errors";
import en from "./locales/en.json";
import es from "./locales/es.json";

interface Asked {
  url: string;
  init: RequestInit;
}

/** The fake network: one answer for every request; what was asked, kept. */
function serve(answer: () => Response | Promise<Response>) {
  const asked: Asked[] = [];
  const fetchImpl = (url: string, init: RequestInit) => {
    asked.push({ url, init });
    return Promise.resolve(answer());
  };
  return { asked, fetchImpl };
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

const pdf = () =>
  new Response(new Blob(["%PDF-1.7"], { type: "application/pdf" }), {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ERP-2026-00123.pdf"' },
  });

afterEach(() => {
  document.documentElement.lang = "";
  vi.unstubAllGlobals();
});

describe("fetchFile", () => {
  it("asks for the file with its Accept and the session cookie, and hands back its bytes and the server's name", async () => {
    const net = serve(pdf);
    const file = await fetchFile("/api/billing/invoices/pdf?id=i-1", "application/pdf", net.fetchImpl);
    expect(net.asked).toEqual([
      { url: "/api/billing/invoices/pdf?id=i-1", init: { headers: { Accept: "application/pdf" }, credentials: "same-origin" } },
    ]);
    expect(await file.blob.text()).toBe("%PDF-1.7");
    expect(file.name).toBe("ERP-2026-00123.pdf");
  });

  it("goes through the page's own fetch when none is given (what a test of the page stubs)", async () => {
    const net = serve(pdf);
    vi.stubGlobal("fetch", net.fetchImpl);
    const file = await fetchFile("/api/billing/invoices/pdf?id=i-1", "application/pdf");
    expect(net.asked.map((a) => a.url)).toEqual(["/api/billing/invoices/pdf?id=i-1"]);
    expect(file.name).toBe("ERP-2026-00123.pdf");
  });

  it("a charset does not make it another file, and without a name from the server the name is empty", async () => {
    const net = serve(() => new Response("﻿Invoice,Date\n", { status: 200, headers: { "Content-Type": "Text/CSV; charset=utf-8" } }));
    const file = await fetchFile("/api/billing/invoices/csv", "text/csv", net.fetchImpl);
    expect(net.asked[0].init).toEqual({ headers: { Accept: "text/csv" }, credentials: "same-origin" });
    expect(file.name).toBe("");
    expect(await file.blob.text()).toBe("﻿Invoice,Date\n");
  });

  it.each([
    [503, "billing.platform_unavailable", "The invoice cannot be downloaded right now. Try again in a moment."],
    [404, "billing.invoice_not_issued", "This invoice is still being issued: its PDF is ready once it is."],
  ])("an error of the API (%i) is thrown as such, with its code and message", async (status, code, message) => {
    const net = serve(() => Response.json({ error: { code, message } }, { status }));
    const failure = await fetchFile("/api/billing/invoices/pdf?id=i-1", "application/pdf", net.fetchImpl).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status, code, message });
  });

  it("an answer that is not the file asked for (a proxy's page with a 200) is never handed back, and says so in the person's language", async () => {
    document.documentElement.lang = "es";
    const net = serve(() => new Response("<html>Bad gateway</html>", { status: 200, headers: { "Content-Type": "text/html" } }));
    const failure = await fetchFile("/api/billing/invoices/pdf?id=i-1", "application/pdf", net.fetchImpl).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 200, code: "unexpected_response", message: es.sdk.errors.unexpected });
  });

  it("JSON with a 200 is not a PDF either", async () => {
    const net = serve(() => Response.json({ ok: true }));
    const failure = await fetchFile("/api/billing/invoices/pdf?id=i-1", "application/pdf", net.fetchImpl).catch((e: unknown) => e);
    expect(failure).toMatchObject({ status: 200, code: "unexpected_response" });
  });

  describe("without network: the SDK's sentence in the person's language, never an English internal text (hub#2281)", () => {
    it.each([
      ["es", es.sdk.errors.network],
      ["es-ES", es.sdk.errors.network],
      ["en", en.sdk.errors.network],
    ])("with the page in %s", async (language, sentence) => {
      document.documentElement.lang = language;
      const failure = await fetchFile("/api/billing/invoices/csv", "text/csv", offline).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ApiError);
      expect(failure).toMatchObject({ status: 0, code: "network_error", message: sentence });
      expect((failure as ApiError).message).not.toMatch(/Network error/);
    });

    it("keeps why for whoever debugs", async () => {
      const failure = (await fetchFile("/api/billing/invoices/csv", "text/csv", offline).catch((e: unknown) => e)) as ApiError;
      expect(failure.details).toEqual({ reason: "Failed to fetch" });
    });

    it("a connection that drops while the file comes is the same failure, never the browser's own text", async () => {
      document.documentElement.lang = "es";
      const cut = () =>
        new Response(new ReadableStream({ start: (controller) => controller.error(new TypeError("network error")) }), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      const failure = await fetchFile("/api/billing/invoices/pdf?id=i-1", "application/pdf", serve(cut).fetchImpl).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ApiError);
      expect(failure).toMatchObject({ status: 0, code: "network_error", message: es.sdk.errors.network });
    });
  });
});

describe("attachmentName", () => {
  it("is the file name the server gives (`Content-Disposition`), plain or encoded (RFC 6266: `filename*` first)", () => {
    expect(attachmentName('attachment; filename="ERP-2026-00123.pdf"')).toBe("ERP-2026-00123.pdf");
    expect(attachmentName("attachment; filename=erplora-invoices-2026-10-14.csv")).toBe("erplora-invoices-2026-10-14.csv");
    expect(attachmentName(`attachment; filename="facturas.csv"; filename*=UTF-8''facturas%20de%20octubre.csv`)).toBe(
      "facturas de octubre.csv",
    );
    expect(attachmentName(null)).toBe("");
    expect(attachmentName("attachment")).toBe("");
  });

  it("a malformed encoded name falls back to the plain one", () => {
    expect(attachmentName(`attachment; filename="plain.pdf"; filename*=UTF-8''bad%E0%A4%A.pdf`)).toBe("plain.pdf");
  });
});
