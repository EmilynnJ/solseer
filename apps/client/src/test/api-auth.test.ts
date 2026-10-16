import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  token: vi.fn(),
  getSession: vi.fn(() => ({ data: { session: { token: "opaque-session" } } })),
}));
vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => auth,
}));
vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: () => ({}),
}));

import { api } from "../lib/api";

describe("JWT authentication at the API boundary", () => {
  const request = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", request);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the JWT to the Worker and never exposes the opaque session token", async () => {
    auth.token.mockResolvedValue({ data: { token: "signed.jwt.token" }, error: null });
    await api("/auth/me");
    const [, init] = request.mock.calls[0]!;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer signed.jwt.token");
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("stops before the API request when refreshing the JWT fails", async () => {
    auth.token.mockResolvedValue({ data: null, error: { message: "Session expired" } });
    await expect(api("/auth/me")).rejects.toThrow("Session expired");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not invent a bearer token when there is no session", async () => {
    auth.token.mockResolvedValue({ data: null, error: null });
    await api("/auth/me");
    const [, init] = request.mock.calls[0]!;
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });
});
