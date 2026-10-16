import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  adapterOptions: null as unknown,
}));
vi.mock("@neondatabase/neon-js/auth", () => ({
  createAuthClient: () => ({ useSession: vi.fn() }),
}));
vi.mock("@neondatabase/neon-js/auth/react/adapters", () => ({
  BetterAuthReactAdapter: (options: unknown) => {
    sdkMocks.adapterOptions = options;
    return vi.fn();
  },
}));

import { getAccessToken } from "./auth";

describe("Neon Auth JWT for the Cloudflare API", () => {
  const request = vi.fn();

  beforeEach(() => {
    request.mockReset();
    vi.stubGlobal("fetch", request);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("configures credentials on the SDK React adapter", () => {
    expect(sdkMocks.adapterOptions).toMatchObject({
      fetchOptions: { credentials: "include" },
    });
  });

  it("retrieves a signed JWT using the session cookie without SDK token caching", async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ token: "header.payload.signature" }), { status: 200 }),
    );
    await expect(getAccessToken()).resolves.toBe("header.payload.signature");
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/\/token$/),
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
  });

  it("returns null when the Auth session has expired", async () => {
    request.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("rejects opaque session identifiers instead of forwarding them to the Worker", async () => {
    request.mockResolvedValue(new Response(JSON.stringify({ token: "opaque-session" })));
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("surfaces unexpected Neon Auth failures", async () => {
    request.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(getAccessToken()).rejects.toThrow("Could not refresh your sign-in session.");
  });
});
