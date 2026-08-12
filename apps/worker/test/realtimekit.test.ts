import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addParticipant,
  createMeeting,
  disableMeeting,
  endSession,
  RealtimeKitProviderError,
  refreshParticipantToken,
  resolveParticipantPresets,
  selectParticipantPresets,
} from "../src/providers/realtimekit";

const realtimeKitEnv = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  CLOUDFLARE_REALTIMEKIT_APP_ID: " app-id ",
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

  it("normalizes canonical secret values and sends the documented meeting payload", async () => {
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

  it("fails closed when only legacy non-KIT secret names are present", async () => {
    const legacyEnv = {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_REALTIME_APP_ID: "legacy-app-id",
      CLOUDFLARE_REALTIME_API_TOKEN: "legacy-token",
    } as unknown as Env;

    await expect(createMeeting(legacyEnv, "reading-id")).rejects.toEqual(
      expect.objectContaining({
        stage: "meeting",
        providerStatus: 0,
        providerCodes: ["missing_api_token"],
      }),
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

describe("RealtimeKit opaque IDs", () => {
  it("allows non-UUID meeting IDs", async () => {
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

    await expect(createMeeting(realtimeKitEnv, "reading-id")).resolves.toBe(
      "custom-non-uuid-meeting-id-12345",
    );
  });

  it("allows non-UUID participant IDs", async () => {
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

    const result = await addParticipant(realtimeKitEnv, {
      meetingId: "meeting-abc",
      appUserId: "user-123",
      displayName: "Emilynn",
      presetName: "group-call-host",
    });

    expect(result).toEqual({
      id: "custom-non-uuid-participant-id-99999",
      token: "mock-token-abc-123",
    });
  });

  it("encodes meeting IDs used in participant URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "participant-id", token: "token" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await addParticipant(realtimeKitEnv, {
      meetingId: "meeting/with?#reserved",
      appUserId: "user-123",
      displayName: "Emilynn",
      presetName: "group-call-host",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/meetings/meeting%2Fwith%3F%23reserved/participants",
    );
  });

  it("encodes meeting and participant IDs used in token refresh URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { token: "new-token" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await refreshParticipantToken(
      realtimeKitEnv,
      "meeting/with?reserved",
      "participant#with/slash",
    );

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/meetings/meeting%2Fwith%3Freserved/participants/participant%23with%2Fslash/token",
    );
  });

  it("encodes meeting IDs when ending and disabling sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await endSession(realtimeKitEnv, "meeting/with?#reserved");
    await disableMeeting(realtimeKitEnv, "meeting/with?#reserved");

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/meetings/meeting%2Fwith%3F%23reserved/active-session/kick-all",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "/meetings/meeting%2Fwith%3F%23reserved",
    );
  });
});
