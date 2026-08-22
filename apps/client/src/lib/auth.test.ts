import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getJWTToken: vi.fn() }));

vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => ({ getJWTToken: authMocks.getJWTToken }),
}));

vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: () => vi.fn(),
}));

import { getAccessToken } from "./auth";

describe("Neon Auth access tokens", () => {
  beforeEach(() => {
    authMocks.getJWTToken.mockReset();
  });

  it("retrieves the JWT through Neon's session-aware SDK", async () => {
    authMocks.getJWTToken.mockResolvedValue("signed.jwt.value");

    await expect(getAccessToken()).resolves.toBe("signed.jwt.value");
    expect(authMocks.getJWTToken).toHaveBeenCalledOnce();
  });

  it("returns null when Neon Auth has no authenticated session", async () => {
    authMocks.getJWTToken.mockResolvedValue(null);

    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("surfaces unexpected Neon Auth SDK failures", async () => {
    authMocks.getJWTToken.mockRejectedValue(new Error("Auth unavailable."));

    await expect(getAccessToken()).rejects.toThrow("Auth unavailable.");
  });
});
