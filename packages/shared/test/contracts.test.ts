import { describe, expect, it } from "vitest";
import { paginationSchema } from "../src/contracts";

describe("paginationSchema", () => {
  it("defaults to page 1 when input is empty", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });

  it("accepts valid positive integers within limits", () => {
    const result = paginationSchema.safeParse({ page: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
    }
  });

  it("rejects non-positive numbers", () => {
    const resultZero = paginationSchema.safeParse({ page: "0" });
    expect(resultZero.success).toBe(false);

    const resultNegative = paginationSchema.safeParse({ page: "-1" });
    expect(resultNegative.success).toBe(false);
  });

  it("rejects pages exceeding maximum limit of 10,000", () => {
    const resultExcessive = paginationSchema.safeParse({ page: "10001" });
    expect(resultExcessive.success).toBe(false);
  });
});
