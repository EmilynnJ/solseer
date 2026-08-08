import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMeeting,
  RealtimeKitProviderError,
  resolveParticipantPresets,
  selectParticipantPresets,
} from "../src/providers/realtimekit";

const realtimeKitEnv = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  REALTIMEKIT_APP_ID: " app-id ",
  CLOUDFLARE_REALTIMEKIT_API_TOKEN: " Bearer test-token ",
} as unknown as Env;

afterEach(() => vi.unstubAllGlobals());

describe("RealtimeKit preset discovery", () => {
  it("prefers SoulSeer's custom presets when they exist", () => {
    expect(
      selectParticipantPresets([
        "group-call-host",
        "soulseer-client",
        "soulseer-reader",
      ]),
    ).toEqual({ client: "soulseer-client", reader: "soulseer-reader" });
  });

  it("falls back to the app's real default group-call presets", () => {
    expect(
      selectParticipantPresets(["group-call-participant", "group-call-host"]),
    ).toEqual({
      client: "group-call-participant",
      reader: "group-call-host",
    });
  });

  it("fails before creating a meeting when the app has no presets", () => {
    expect(() => selectParticipantPresets([])).toThrow(
      RealtimeKitProviderError,
    );
  });

  it("uses Cloudflare's dashboard defaults without listing presets", async () => {
    await expect(resolveParticipantPresets({} as Env)).resolves.toEqual({
      client: "group-call-participant",
      reader: "group-call-host",
    });
  });

  it("normalizes secret values and sends the documented meeting payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMeeting(realtimeKitEnv, "reading-id")).resolves.toBe(
      "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/meetings",
    );
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
    if (typeof init.body !== "string") {
      throw new Error("Expected the meeting request body to be JSON text.");
    }
    expect(JSON.parse(init.body)).toEqual({
      title: "SoulSeer reading reading-id",
      persist_chat: true,
    });
  });

  it("accepts direct Worker secret names as a runtime fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const directSecretEnv = {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_REALTIME_APP_ID: "direct-app-id",
      CLOUDFLARE_REALTIME_TOKEN: "direct-token",
    } as unknown as Env;

    await createMeeting(directSecretEnv, "reading-id");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/realtime/kit/direct-app-id/meetings");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer direct-token",
    );
  });

  it("preserves Cloudflare's status and error code for safe diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ code: 10000 }] }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(createMeeting(realtimeKitEnv, "reading-id")).rejects.toEqual(
      expect.objectContaining({
        stage: "meeting",
        providerStatus: 403,
        providerCodes: ["10000"],
      }),
    );
  });
});
