// The sentences the SDK writes itself, for a failure the server did not word (hub#2281): in the person's
// language, saying what happened and what to do — never «Unexpected response (HTTP 502)».
import { afterEach, describe, expect, it } from "vitest";
import en from "./locales/en.json";
import es from "./locales/es.json";
import { sdkMessage } from "./messages";

function keys(tree: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

afterEach(() => {
  document.documentElement.lang = "";
});

describe("sdkMessage", () => {
  it("has the same sentences in en and es, none empty", () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
    expect(keys(en).sort()).toEqual(["sdk.errors.network", "sdk.errors.signedOut", "sdk.errors.unexpected"]);
    for (const tree of [en, es]) for (const text of Object.values(tree.sdk.errors)) expect(text.trim()).not.toBe("");
  });

  it("speaks the language it is asked in, and English for one it does not know", () => {
    expect(sdkMessage("unexpected", "es-ES")).toBe(es.sdk.errors.unexpected);
    expect(sdkMessage("unexpected", "en")).toBe(en.sdk.errors.unexpected);
    expect(sdkMessage("network", "fr")).toBe(en.sdk.errors.network);
  });

  it("speaks the language of the page when it is not told one", () => {
    document.documentElement.lang = "es";
    expect(sdkMessage("signedOut")).toBe(es.sdk.errors.signedOut);
    document.documentElement.lang = "";
    expect(sdkMessage("signedOut")).toBe(en.sdk.errors.signedOut);
  });

  it("says what happened and what to do, with no HTTP status or English internal text", () => {
    expect(es.sdk.errors.unexpected).toMatch(/No se pudo completar/);
    expect(es.sdk.errors.unexpected).toMatch(/vuelve a intentarlo/i);
    expect(es.sdk.errors.network).toMatch(/conexión/);
    expect(es.sdk.errors.signedOut).toMatch(/Vuelve a entrar/);
    for (const tree of [en, es]) for (const text of Object.values(tree.sdk.errors)) expect(text).not.toMatch(/HTTP|\d{3}/);
  });
});
