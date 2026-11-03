import { afterEach } from "vitest";
import { api, ApiError } from "../src/api/client.js";

function mockFetch(status: number, body?: unknown, contentType = "application/json") {
  const res = new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
  const fn = vi.fn().mockResolvedValue(res);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api()", () => {
  it("returns the parsed JSON body and always sends cookies", async () => {
    const fetchFn = mockFetch(200, { status: "ok" });
    await expect(api("/api/health")).resolves.toEqual({ status: "ok" });
    expect(fetchFn.mock.calls[0][1].credentials).toBe("include");
  });

  it("sends a string body as JSON", async () => {
    const fetchFn = mockFetch(200, {});
    await api("/api/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    expect((fetchFn.mock.calls[0][1].headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("resolves 204 to undefined", async () => {
    mockFetch(204);
    await expect(api("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws ApiError with the server's status, code, message and details", async () => {
    mockFetch(400, {
      error: { code: "ALLOCATION_MISMATCH", message: "Lines must equal the total.", details: { diff: 100 } },
    });
    const err = await api("/api/transactions").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: "ALLOCATION_MISMATCH",
      message: "Lines must equal the total.",
      details: { diff: 100 },
    });
  });

  it("throws a generic ApiError when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Gateway", { status: 502 })));
    await expect(api("/api/health")).rejects.toMatchObject({ status: 502, code: "INTERNAL_ERROR" });
  });
});
