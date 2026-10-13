import { describe, expect, it } from "vitest";
import { createHeaderProvider, type HeaderDeps } from "./headers";

const cfg = { csrfCookieName: "hub_csrf", csrfHeader: "X-CSRFToken", deviceIdStorageKey: "erplora.device_id" };

const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

function deps(overrides: Partial<HeaderDeps> = {}): HeaderDeps {
  let n = 0;
  return {
    storage: memoryStorage(),
    cookies: () => "other=1; hub_csrf=tok%2Den; csrftoken=wrong",
    randomUUID: () => UUIDS[n++ % UUIDS.length],
    ...overrides,
  };
}

describe("createHeaderProvider", () => {
  it("sends the live headers without CSRF", () => {
    const h = createHeaderProvider(cfg, deps());
    expect(h.liveHeaders()).toEqual({
      Accept: "text/event-stream",
      "X-Device-Id": UUIDS[0],
      "X-Client-Instance": UUIDS[1],
    });
  });

  it("persists the device id in storage under the configured key", () => {
    const d = deps();
    createHeaderProvider(cfg, d);
    expect(d.storage.getItem("erplora.device_id")).toBe(UUIDS[0]);
  });

  it("reuses the stored device id across providers but not the client instance", () => {
    const storage = memoryStorage();
    const a = createHeaderProvider(cfg, deps({ storage }));
    const b = createHeaderProvider(cfg, deps({ storage, randomUUID: () => UUIDS[3] }));
    expect(b.liveHeaders()["X-Device-Id"]).toBe(a.liveHeaders()["X-Device-Id"]);
    expect(b.liveHeaders()["X-Client-Instance"]).not.toBe(a.liveHeaders()["X-Client-Instance"]);
  });

  it("keeps the client instance stable within one provider", () => {
    const h = createHeaderProvider(cfg, deps());
    expect(h.apiHeaders("GET")["X-Client-Instance"]).toBe(h.liveHeaders()["X-Client-Instance"]);
    expect(h.liveHeaders()["X-Client-Instance"]).toBe(h.liveHeaders()["X-Client-Instance"]);
  });

  it("replaces a stored device id that is not a UUID", () => {
    const storage = memoryStorage();
    storage.setItem("erplora.device_id", "garbage");
    const h = createHeaderProvider(cfg, deps({ storage }));
    expect(h.liveHeaders()["X-Device-Id"]).toBe(UUIDS[0]);
    expect(storage.getItem("erplora.device_id")).toBe(UUIDS[0]);
  });

  it("still sends a device id when storage is unavailable", () => {
    const broken = memoryStorage();
    broken.getItem = () => {
      throw new Error("SecurityError");
    };
    broken.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const h = createHeaderProvider(cfg, deps({ storage: broken }));
    expect(h.liveHeaders()["X-Device-Id"]).toBe(UUIDS[0]);
  });

  it("adds the CSRF header from the configured cookie only on unsafe methods", () => {
    const h = createHeaderProvider(cfg, deps());
    for (const method of ["POST", "put", "PATCH", "DELETE"]) {
      expect(h.apiHeaders(method)["X-CSRFToken"]).toBe("tok-en");
    }
    for (const method of ["GET", "head", "OPTIONS"]) {
      expect(h.apiHeaders(method)).not.toHaveProperty("X-CSRFToken");
    }
  });

  it("uses the configured CSRF header name", () => {
    const h = createHeaderProvider({ ...cfg, csrfHeader: "X-Other" }, deps());
    expect(h.apiHeaders("POST")["X-Other"]).toBe("tok-en");
    expect(h.apiHeaders("POST")).not.toHaveProperty("X-CSRFToken");
  });

  it("reads the cookie at call time", () => {
    let jar = "";
    const h = createHeaderProvider(cfg, deps({ cookies: () => jar }));
    expect(h.apiHeaders("POST")).not.toHaveProperty("X-CSRFToken");
    jar = "hub_csrf=fresh";
    expect(h.apiHeaders("POST")["X-CSRFToken"]).toBe("fresh");
  });

  it("does not match a cookie whose name only contains the configured name", () => {
    const h = createHeaderProvider(cfg, deps({ cookies: () => "xhub_csrf=nope; hub_csrf_old=nope" }));
    expect(h.apiHeaders("POST")).not.toHaveProperty("X-CSRFToken");
  });

  it("sends the API headers with JSON accept", () => {
    const h = createHeaderProvider(cfg, deps());
    expect(h.apiHeaders("GET")).toEqual({
      Accept: "application/json",
      "X-Device-Id": UUIDS[0],
      "X-Client-Instance": UUIDS[1],
    });
  });

  it("adds the elevation token when the hook provides one", () => {
    let token: string | undefined = "elev-1";
    const h = createHeaderProvider(cfg, deps({ getElevationToken: () => token }));
    expect(h.liveHeaders()["X-Elevation-Token"]).toBe("elev-1");
    expect(h.apiHeaders("POST")["X-Elevation-Token"]).toBe("elev-1");
    token = undefined;
    expect(h.liveHeaders()).not.toHaveProperty("X-Elevation-Token");
    expect(h.apiHeaders("POST")).not.toHaveProperty("X-Elevation-Token");
  });
});
