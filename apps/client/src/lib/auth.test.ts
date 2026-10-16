import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  token: vi.fn(),
}));

vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => ({
    getSession: authMocks.getSession,
    token: authMocks.token,
    useSession: vi.fn(),
  }),
}));

vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: () => vi.fn(),
}));

import { getAccessToken } from "./auth";

const jwt = "signed.jwt.value";

describe("Neon Auth access tokens", () => {
  beforeEach(() => {
    authMocks.getSession.mockReset();
    authMocks.token.mockReset();
  });

  it("uses Neon SDK's JWT-injected session token first", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { user: { id: "1" }, session: { token: jwt } }, error: null,
    });

    await expect(getAccessToken()).resolves.toBe(jwt);
    expect(authMocks.token).not.toHaveBeenCalled();
  });

  it("falls back to the JWT endpoint for an opaque session token", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { user: { id: "1" }, session: { token: "opaque-session" } }, error: null,
    });
    authMocks.token.mockResolvedValue({ data: { token: jwt }, error: null });

    await expect(getAccessToken()).resolves.toBe(jwt);
  });

  it("returns null when no Neon Auth user is signed in", async () => {
    authMocks.getSession.mockResolvedValue({ data: null, error: null });
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("rejects a signed-in session with no JWT instead of silently sending unauthenticated API requests", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { user: { id: "1" }, session: { token: "opaque" } }, error: null,
    });
    authMocks.token.mockResolvedValue({ data: null, error: null });

    await expect(getAccessToken()).rejects.toThrow("API access token is missing");
  });

  it("surfaces errors from Neon Auth token retrieval", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { user: { id: "1" }, session: { token: "opaque" } }, error: null,
    });
    authMocks.token.mockRejectedValue(new Error("Auth unavailable."));

    await expect(getAccessToken()).rejects.toThrow("Auth unavailable.");
  });
});
