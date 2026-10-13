import { describe, expect, it } from "vitest";
import { automatedFlagReason, scanContent } from "../src/lib/content-scan";

describe("automated content scanning", () => {
  it("leaves ordinary community posts alone", () => {
    expect(scanContent("The Tower card came up again today and I feel ready for change.")).toEqual([]);
    expect(automatedFlagReason([])).toBeNull();
  });

  it.each([
    ["Email me at reader@example.com", "contact details (email address)"],
    ["Call 555-123-4567 tonight", "contact details (phone number)"],
    ["Pay me on Cash App instead", "off-platform payment"],
    ["Send it to $mysticmoon", "off-platform payment"],
    ["Message me on WhatsApp", "off-platform contact"],
    ["See https://example.com", "external link"],
    ["My readings are 100% accurate", "guaranteed outcome claim"],
    ["Some days I want to die", "possible self-harm (check on this person)"],
  ])("flags %s", (text, reason) => {
    expect(scanContent(text)).toContain(reason);
  });

  it("labels automated reports so the admin queue can tell them apart", () => {
    expect(automatedFlagReason(["external link", "off-platform payment"])).toBe(
      "Automated scan: external link; off-platform payment",
    );
  });
});

describe("reserved report reasons", () => {
  it("stops user reports from posing as automated scans", async () => {
    const { isReservedFlagReason } = await import("../src/lib/content-scan");
    expect(isReservedFlagReason("  automated SCAN: fake")).toBe(true);
    expect(isReservedFlagReason("This post is spam")).toBe(false);
  });
});
