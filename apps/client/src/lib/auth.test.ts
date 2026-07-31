import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => ({}),
}));

vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: () => vi.fn(),
}));

import { getAccessToken } from "./auth";

describe("Neon Auth access tokens", () => {
  beforeEach(() => {
    authMocks.fetch.mockReset();
    vi.stubGlobal("fetch", authMocks.fetch);
  });

  it("retrieves the JWT from Neon's credentialed token endpoint", async () => {
    authMocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ token: "signed.jwt.value" }),
    });

    await expect(getAccessToken()).resolves.toBe("signed.jwt.value");
    expect(authMocks.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/auth/token",
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
  });

  it("returns null when Neon Auth reports no authenticated session", async () => {
    authMocks.fetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("rejects unexpected Neon Auth failures", async () => {
    authMocks.fetch.mockResolvedValue({ ok: false, status: 502 });

    await expect(getAccessToken()).rejects.toThrow(
      "Neon Auth token request failed (502).",
    );
  });
});
