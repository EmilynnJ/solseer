import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

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

  it("reads the JWT injected into the Neon Auth session", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { token: "signed.jwt.value" } },
      error: null,
    });

    await expect(getAccessToken()).resolves.toBe("signed.jwt.value");
    expect(authMocks.getSession).toHaveBeenCalledOnce();
  });

  it("returns null when no authenticated JWT is available", async () => {
    authMocks.getSession.mockResolvedValue({ data: null, error: null });

    await expect(getAccessToken()).resolves.toBeNull();
  });
});
