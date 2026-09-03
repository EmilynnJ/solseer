import { describe, expect, it } from "vitest";
import { resolveAccountSecrets } from "../src/lib/account-secrets";

// Secrets Store RPC bindings expose arbitrary method names, including R2/DO
// method names. This matches the binding shape verified with Miniflare/workerd.
function rpcSecret(value: string) {
  return new Proxy({}, {
    has: () => true,
    get: (_target, key) => key === "get"
      ? () => Promise.resolve(value)
      : () => Promise.reject(new Error("Not a supported RPC method")),
  });
}

describe("account secret resolution", () => {
  it("resolves the RealtimeKit token and app ID from RPC-backed bindings", async () => {
    const resolved = await resolveAccountSecrets({
      CLOUDFLARE_REALTIMEKIT_API_TOKEN: rpcSecret("test-token"),
      CLOUDFLARE_REALTIMEKIT_APP_ID: rpcSecret("test-app"),
    } as unknown as Env);

    expect(typeof resolved.CLOUDFLARE_REALTIMEKIT_API_TOKEN).toBe("string");
    expect(resolved.CLOUDFLARE_REALTIMEKIT_API_TOKEN).toBe("test-token");
    expect((resolved as unknown as Record<string, unknown>).CLOUDFLARE_REALTIMEKIT_APP_ID).toBe("test-app");
  });

  it("does not invoke unrelated resource bindings", async () => {
    let resourceReads = 0;
    const resource = { get: () => { resourceReads++; return Promise.resolve("not-a-secret"); } };
    const resolved = await resolveAccountSecrets({
      CLOUDFLARE_REALTIMEKIT_API_TOKEN: "direct-test-token",
      OTHER_SERVICE: resource,
    } as unknown as Env);

    expect(resolved.CLOUDFLARE_REALTIMEKIT_API_TOKEN).toBe("direct-test-token");
    expect(resourceReads).toBe(0);
    expect((resolved as unknown as Record<string, unknown>).OTHER_SERVICE).toBe(resource);
  });
});
