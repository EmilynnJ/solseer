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

  it("rejects presets that cannot prove distinct participant and host roles", () => {
    expect(() =>
      selectParticipantPresets(["viewer", "moderator"]),
    ).toThrowError(
      expect.objectContaining({
        stage: "presets",
        providerCodes: ["role_presets_not_found"],
      }),
    );
  });

  it("rejects one preset that matches both roles", () => {
    expect(() =>
      selectParticipantPresets(["group-host-participant"]),
    ).toThrowError(
      expect.objectContaining({
        stage: "presets",
        providerCodes: ["role_presets_not_distinct"],
      }),
    );
  });

  it("uses the exact preset names returned by the RealtimeKit app", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { id: "participant-preset-id", name: "group_call_participant" },
            { id: "host-preset-id", name: "group_call_host" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveParticipantPresets(realtimeKitEnv)).resolves.toEqual({
      client: "group_call_participant",
      reader: "group_call_host",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-id/realtime/kit/app-id/presets",
    );
    expect(init.method).toBe("GET");
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

describe("RealtimeKit Preflight and Initial Connection ID relaxation", () => {
  it("allows non-UUID meeting ID inside createMeeting response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "custom-non-uuid-meeting-id-12345" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createMeeting: createMeetingFn } = await import("../src/providers/realtimekit");
    await expect(createMeetingFn(realtimeKitEnv, "reading-id")).resolves.toBe(
      "custom-non-uuid-meeting-id-12345",
    );
  });

  it("allows non-UUID participant ID inside addParticipant response (Preflight setup)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "custom-non-uuid-participant-id-99999",
            token: "mock-token-abc-123",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { addParticipant: addParticipantFn } = await import("../src/providers/realtimekit");
    const res = await addParticipantFn(realtimeKitEnv, {
      meetingId: "meeting-abc",
      appUserId: "user-123",
      displayName: "Emilynn",
      presetName: "group-call-host",
    });

    expect(res).toEqual({
      id: "custom-non-uuid-participant-id-99999",
      token: "mock-token-abc-123",
    });
  });

  it("allows non-UUID participant ID inside refreshParticipantToken response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { token: "new-mock-token-456" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { refreshParticipantToken: refreshParticipantTokenFn } = await import("../src/providers/realtimekit");
    const token = await refreshParticipantTokenFn(
      realtimeKitEnv,
      "meeting-abc",
      "custom-non-uuid-participant-id-99999",
    );

    expect(token).toBe("new-mock-token-456");
  });

  it("parses webhook events cleanly when customParticipantId is omitted or a non-UUID string", async () => {
    const { realtimeKitEventSchema } = await import("@soulseer/shared");

    const payloadNoCustomId = {
      event: "meeting.participantJoined",
      meeting: { id: "meeting-1" },
      participant: { peerId: "peer-1" },
    };
    expect(() => realtimeKitEventSchema.parse(payloadNoCustomId)).not.toThrow();

    const payloadStringCustomId = {
      event: "meeting.participantLeft",
      meeting: { id: "meeting-1" },
      participant: { peerId: "peer-1", customParticipantId: "non-uuid-user-id" },
    };
    const parsed = realtimeKitEventSchema.parse(payloadStringCustomId);
    expect(parsed.participant?.customParticipantId).toBe("non-uuid-user-id");
  });
});

