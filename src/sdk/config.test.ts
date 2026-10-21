import { afterEach, describe, expect, it } from "vitest";
import { readSpaConfig, SpaConfigError } from "./config";

function docWith(json: string | null, type = "application/json"): Document {
  const doc = document.implementation.createHTMLDocument("t");
  if (json !== null) {
    const el = doc.createElement("script");
    el.id = "spa-config";
    el.type = type;
    el.textContent = json;
    doc.head.appendChild(el);
  }
  return doc;
}

describe("readSpaConfig", () => {
  afterEach(() => {
    document.getElementById("spa-config")?.remove();
  });

  it("reads the required fields and fills the defaults", () => {
    const cfg = readSpaConfig(docWith('{"csrfCookieName":"hub_csrftoken","lang":"es"}'));
    expect(cfg).toEqual({
      csrfCookieName: "hub_csrftoken",
      csrfHeader: "X-CSRFToken",
      liveUrl: "/api/live",
      apiBase: "/api",
      lang: "es",
      deviceIdStorageKey: "erplora.device_id",
    });
  });

  it("keeps the optional overrides", () => {
    const cfg = readSpaConfig(
      docWith(
        JSON.stringify({
          csrfCookieName: "c",
          csrfHeader: "X-Custom-CSRF",
          liveUrl: "/live",
          apiBase: "/v2",
          lang: "en",
          palette: "teal",
          deviceIdStorageKey: "k",
          loginUrl: "https://hub.erplora.com/hub-login/?hub=a",
        }),
      ),
    );
    expect(cfg).toEqual({
      csrfCookieName: "c",
      csrfHeader: "X-Custom-CSRF",
      liveUrl: "/live",
      apiBase: "/v2",
      lang: "en",
      palette: "teal",
      deviceIdStorageKey: "k",
      loginUrl: "https://hub.erplora.com/hub-login/?hub=a",
    });
  });

  it("reads the global document by default", () => {
    const el = document.createElement("script");
    el.id = "spa-config";
    el.type = "application/json";
    el.textContent = '{"csrfCookieName":"csrftoken","lang":"en"}';
    document.head.appendChild(el);
    expect(readSpaConfig().csrfCookieName).toBe("csrftoken");
  });

  it("fails clearly when the element is missing", () => {
    expect(() => readSpaConfig(docWith(null))).toThrow(SpaConfigError);
    expect(() => readSpaConfig(docWith(null))).toThrow(/script id="spa-config"/);
  });

  it("fails when the element is not a JSON script", () => {
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en"}', "text/javascript"))).toThrow(
      /application\/json/,
    );
  });

  it("fails when the content is not valid JSON", () => {
    expect(() => readSpaConfig(docWith("{nope"))).toThrow(/not valid JSON/);
  });

  it("fails when the content is not an object", () => {
    expect(() => readSpaConfig(docWith("[]"))).toThrow(/JSON object/);
  });

  it("requires the CSRF cookie name instead of assuming one", () => {
    expect(() => readSpaConfig(docWith('{"lang":"en"}'))).toThrow(/csrfCookieName/);
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"","lang":"en"}'))).toThrow(/csrfCookieName/);
  });

  it("requires the language", () => {
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c"}'))).toThrow(/lang/);
  });

  it("passes through a valid op → route map", () => {
    const routes = { "demo.item.list": { method: "get", path: "/api/demo/items" } };
    const cfg = readSpaConfig(docWith(JSON.stringify({ csrfCookieName: "c", lang: "en", routes })));
    expect(cfg.routes).toEqual(routes);
  });

  it("rejects a malformed route map with a clear message", () => {
    const bad = { csrfCookieName: "c", lang: "en", routes: { "demo.item.list": { method: "GET", path: "/x" } } };
    expect(() => readSpaConfig(docWith(JSON.stringify(bad)))).toThrow(SpaConfigError);
    expect(() => readSpaConfig(docWith(JSON.stringify(bad)))).toThrow(/routes.*demo\.item\.list.*method/);
  });

  it("rejects optional fields with the wrong type", () => {
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","liveUrl":5}'))).toThrow(/liveUrl/);
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","palette":""}'))).toThrow(/palette/);
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","loginUrl":7}'))).toThrow(/loginUrl/);
  });

  it("keeps googleEnabled, the SaaS login's switch for «Continue with Google»", () => {
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","googleEnabled":true}')).googleEnabled).toBe(true);
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","googleEnabled":false}')).googleEnabled).toBe(false);
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en"}'))).not.toHaveProperty("googleEnabled");
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","googleEnabled":"yes"}'))).toThrow(
      /googleEnabled/,
    );
  });

  it("keeps mfaEnabled, the SaaS's switch for two-step verification (its endpoints answer 404 without it)", () => {
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","mfaEnabled":true}')).mfaEnabled).toBe(true);
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","mfaEnabled":false}')).mfaEnabled).toBe(false);
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en"}'))).not.toHaveProperty("mfaEnabled");
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","mfaEnabled":"no"}'))).toThrow(/mfaEnabled/);
  });

  it("keeps hubOrigin, a hub's origin with {slug} to fill in (the SaaS names a hub from its slug)", () => {
    const raw = '{"csrfCookieName":"c","lang":"en","hubOrigin":"https://{slug}.erplora.com"}';
    expect(readSpaConfig(docWith(raw)).hubOrigin).toBe("https://{slug}.erplora.com");
    expect(readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en"}'))).not.toHaveProperty("hubOrigin");
    expect(() => readSpaConfig(docWith('{"csrfCookieName":"c","lang":"en","hubOrigin":""}'))).toThrow(/hubOrigin/);
  });
});
