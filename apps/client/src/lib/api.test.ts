import { describe, expect, it } from "vitest";
import { duration, money } from "./api";

describe("display-only financial formatting", () => {
  it("formats integer cents without changing their value", () => {
    expect(money(2_505)).toBe("$25.05");
    expect(money(-199)).toBe("-$1.99");
  });

  it("formats elapsed seconds as minutes and seconds", () => {
    expect(duration(0)).toBe("0:00");
    expect(duration(125)).toBe("2:05");
  });
});
