import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => ({ getSession: authMocks.getSession }),
}));

vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: () => vi.fn(),
}));

import { getAccessToken } from "./auth";

describe("Neon Auth access tokens", () => {
  beforeEach(() => {
    authMocks.getSession.mockReset();
  });

  it("retrieves the JWT through Neon's session-aware SDK", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { token: "signed.jwt.value" } },
    });

    await expect(getAccessToken()).resolves.toBe("signed.jwt.value");
    expect(authMocks.getSession).toHaveBeenCalledOnce();
  });

  it("returns null when Neon Auth has no authenticated session", async () => {
    authMocks.getSession.mockResolvedValue({ data: null });

    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("surfaces unexpected Neon Auth SDK failures", async () => {
    authMocks.getSession.mockRejectedValue(new Error("Auth unavailable."));

    await expect(getAccessToken()).rejects.toThrow("Auth unavailable.");
  });
});
