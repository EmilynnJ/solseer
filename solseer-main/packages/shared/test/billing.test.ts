import { describe, expect, it } from "vitest";
import { splitReadingCharge } from "../src/constants";

describe("splitReadingCharge", () => {
  it("splits ordinary charges 70/30", () => {
    expect(splitReadingCharge(500)).toEqual({ readerCents: 350, platformCents: 150 });
  });

  it("rounds the reader share down and assigns the remainder to SoulSeer", () => {
    expect(splitReadingCharge(101)).toEqual({ readerCents: 70, platformCents: 31 });
  });

  it("rejects invalid amounts", () => {
    expect(() => splitReadingCharge(-1)).toThrow(RangeError);
    expect(() => splitReadingCharge(1.5)).toThrow(RangeError);
  });
});
