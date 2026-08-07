import { describe, expect, it } from "vitest";
import {
  RealtimeKitProviderError,
  resolveParticipantPresets,
  selectParticipantPresets,
} from "../src/providers/realtimekit";

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
});
