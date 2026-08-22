import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ token: vi.fn() }));

vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => ({ token: authMocks.token }),
}));

vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: () => vi.fn(),
}));

import { getAccessToken } from "./auth";

describe("Neon Auth access tokens", () => {
  beforeEach(() => {
    authMocks.token.mockReset();
  });

  it("retrieves the signed JWT from Neon's token endpoint", async () => {
    authMocks.token.mockResolvedValue({
      data: { token: "signed.jwt.value" },
      error: null,
    });

    await expect(getAccessToken()).resolves.toBe("signed.jwt.value");
  });

  it("returns null when Neon Auth has no authenticated session", async () => {
    authMocks.token.mockResolvedValue({ data: null, error: null });

    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("surfaces unexpected Neon Auth SDK failures", async () => {
    authMocks.token.mockRejectedValue(new Error("Auth unavailable."));

    await expect(getAccessToken()).rejects.toThrow("Auth unavailable.");
  });
});
