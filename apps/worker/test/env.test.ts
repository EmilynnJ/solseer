import { describe, expect, it, vi } from "vitest";
import { resolveAccountSecrets } from "../src/lib/env";

describe("Cloudflare Secrets Store resolution", () => {
  it("resolves the exact RealtimeKit secret names used in Secrets Store", async () => {
    const appIdGet = vi.fn().mockResolvedValue("soulseer-app-id");
    const tokenGet = vi.fn().mockResolvedValue("soulseer-api-token");
    const env = {
      ENVIRONMENT: "production",
      CLOUDFLARE_REALTIME_APP_ID: { get: appIdGet },
      CLOUDFLARE_REALTIME_TOKEN: { get: tokenGet },
    } as unknown as Env;

    const resolved = await resolveAccountSecrets(env);

    expect(resolved.CLOUDFLARE_REALTIME_APP_ID).toBe("soulseer-app-id");
    expect(resolved.CLOUDFLARE_REALTIME_TOKEN).toBe("soulseer-api-token");
    expect(resolved.ENVIRONMENT).toBe("production");
    expect(appIdGet).toHaveBeenCalledOnce();
    expect(tokenGet).toHaveBeenCalledOnce();
  });

  it("keeps the previous alias bindings compatible", async () => {
    const env = {
      REALTIMEKIT_APP_ID: { get: () => Promise.resolve("legacy-app-id") },
      CLOUDFLARE_REALTIMEKIT_API_TOKEN: {
        get: () => Promise.resolve("legacy-api-token"),
      },
    } as unknown as Env;

    const resolved = await resolveAccountSecrets(env);

    expect(resolved.REALTIMEKIT_APP_ID).toBe("legacy-app-id");
    expect(resolved.CLOUDFLARE_REALTIMEKIT_API_TOKEN).toBe(
      "legacy-api-token",
    );
  });

  it("reports the binding name without exposing its value when get fails", async () => {
    const env = {
      CLOUDFLARE_REALTIME_TOKEN: {
        get: () =>
          Promise.reject(new Error("provider detail that must not escape")),
      },
    } as unknown as Env;

    await expect(resolveAccountSecrets(env)).rejects.toMatchObject({
      name: "AccountSecretResolutionError",
      bindingName: "CLOUDFLARE_REALTIME_TOKEN",
    });
  });
});
