import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock("../lib/auth", () => ({ getAccessToken: auth.getAccessToken }));

import { api } from "../lib/api";

describe("JWT authentication at the API boundary", () => {
  const request = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", request);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the signed JWT to the Worker", async () => {
    auth.getAccessToken.mockResolvedValue("header.payload.signature");
    await api("/auth/me");
    const [, init] = request.mock.calls[0]!;
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer header.payload.signature",
    );
  });

  it("stops before the API request when refreshing the JWT fails", async () => {
    auth.getAccessToken.mockRejectedValue(new Error("Session expired"));
    await expect(api("/auth/me")).rejects.toThrow("Session expired");
    expect(request).not.toHaveBeenCalled();
  });

  it("never sends a protected API request without a signed JWT", async () => {
    auth.getAccessToken.mockResolvedValue(null);
    await expect(api("/auth/me")).rejects.toThrow("Please sign in again.");
    expect(request).not.toHaveBeenCalled();
  });
});
