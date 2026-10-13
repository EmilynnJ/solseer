import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadingCoordinator } from "../src/durable/reading-coordinator";

// Replace only the external database boundary; use the real coordinator,
// Durable Object storage, secret resolver and RealtimeKit provider functions.
vi.mock("../src/lib/db", () => ({
  createDatabase: () => ({
    db: { update: () => ({ set: () => ({ where: () => Promise.resolve() }) }) },
  }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("ReadingCoordinator secret-backed finalization", () => {
  it.each(["participant", "alarm"] as const)(
    "resolves credentials when ending via %s",
    async (trigger) => {
      const requests: { url: string; method: string; authorization: string | null }[] = [];
      vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
        requests.push({
          url, method: init.method ?? "GET",
          authorization: new Headers(init.headers).get("Authorization"),
        });
        return Promise.resolve(new Response(null, { status: 204 }));
      });
      const stub = env.READING_COORDINATOR.getByName(crypto.randomUUID());
      await runInDurableObject(stub, async (_instance, ctx) => {
        const coordinator = new ReadingCoordinator(ctx, {
          ...env,
          CLOUDFLARE_ACCOUNT_ID: "test-account",
          CLOUDFLARE_REALTIMEKIT_APP_ID: { get: () => Promise.resolve("test-app") },
          CLOUDFLARE_REALTIMEKIT_API_TOKEN: { get: () => Promise.resolve("test-token") },
        } as unknown as Env);
        await coordinator.initialize({
          readingId: "test-reading", meetingId: "test-meeting",
          clientId: "test-client", readerId: "test-reader",
        });
        try {
          if (trigger === "participant") {
            await coordinator.requestEnd("test-reader");
          } else {
            const state = await coordinator.getSnapshot();
            await ctx.storage.put("coordinator-state", {
              ...state, status: "ending", finalizationStarted: false,
              endAtMs: Date.now(), endReason: "finalization_retry",
            });
            await coordinator.alarm();
          }
          expect((await coordinator.getSnapshot()).status).toBe("ended");
          expect(await ctx.storage.getAlarm()).toBeNull();
        } finally {
          await ctx.storage.deleteAlarm();
        }
      });
      expect(requests).toEqual([
        {
          url: "https://api.cloudflare.com/client/v4/accounts/test-account/realtime/kit/test-app/meetings/test-meeting/active-session/kick-all",
          method: "POST", authorization: "Bearer test-token",
        },
        {
          url: "https://api.cloudflare.com/client/v4/accounts/test-account/realtime/kit/test-app/meetings/test-meeting",
          method: "PATCH", authorization: "Bearer test-token",
        },
      ]);
    },
  );
});
