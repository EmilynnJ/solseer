import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAccountSecrets } from "../src/lib/account-secrets";
import { smsIsConfigured } from "../src/providers/telnyx";
import { createMeeting } from "../src/providers/realtimekit";

afterEach(() => vi.unstubAllGlobals());

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
  it.each([
    ["CLOUDFLARE_REALTIMEKIT_API_TOKEN", "token"],
    ["REALTIMEKIT_API_TOKEN", "token"],
    ["CLOUDFLARE_REALTIME_TOKEN", "token"],
    ["REALTIME_TOKEN", "token"],
    ["CLOUDFLARE_REALTIME_API_TOKEN", "token"],
    ["REALTIME_API_TOKEN", "token"],
    ["REALTIMEKIT_TOKEN", "token"],
    ["CLOUDFLARE_REALTIME_APP_ID", "app"],
    ["REALTIMEKIT_APP_ID", "app"],
    ["REALTIMEKIT_API_APP_ID", "app"],
    ["CLOUDFLARE_REALTIMEKIT_APP_ID", "app"],
    ["REALTIMEKIT_APP_ID_API", "app"],
    ["REALTIMEKIT_APP_API_ID", "app"],
    ["REALTIME_APP_ID", "app"],
  ])("supports an existing provider alias backed by Secrets Store: %s", async (name, kind) => {
    const input: Record<string, unknown> = {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      ...(kind === "token"
        ? { REALTIMEKIT_APP_ID: "app-id" }
        : { CLOUDFLARE_REALTIMEKIT_API_TOKEN: "test-token" }),
      [name]: rpcSecret(kind === "token" ? "test-token" : "app-id"),
    };
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/meetings");
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
      return Promise.resolve(Response.json({ success: true, data: { id: "meeting-id" } }));
    });
    const resolved = await resolveAccountSecrets(input as unknown as Env);
    await expect(createMeeting(resolved, "reading-id")).resolves.toBe("meeting-id");
  });

  it.each(["throws", "empty", "whitespace"])(
    "makes a failed SMS secret unavailable when it %s",
    async (failure) => {
      const binding = {
        get: () => failure === "throws"
          ? Promise.reject(new Error("test provider failure"))
          : Promise.resolve(failure === "empty" ? "" : "   "),
      };
      const original = {
        TELNYX_API_KEY: binding,
        TELNYX_FROM_NUMBER: "+15555550100",
      } as unknown as Env;
      const resolved = await resolveAccountSecrets(original);
      expect(smsIsConfigured(resolved)).toBe(false);
      expect(resolved.TELNYX_API_KEY).toBeUndefined();
      expect(original.TELNYX_API_KEY).toBe(binding);
    },
  );

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
