import { describe, expect, it } from "vitest";
import { ApiError, duration, isProfileRequiredError, money } from "./api";

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

describe("profile bootstrap errors", () => {
  it("recognizes the API profile-required contract", () => {
    expect(
      isProfileRequiredError(
        new ApiError("Complete your profile.", 409, "PROFILE_REQUIRED"),
      ),
    ).toBe(true);
  });

  it("keeps backward compatibility with a not-found profile response", () => {
    expect(
      isProfileRequiredError(new ApiError("Profile not found.", 404, "NOT_FOUND")),
    ).toBe(true);
  });

  it("does not misroute unrelated API failures into profile completion", () => {
    expect(
      isProfileRequiredError(new ApiError("Service unavailable.", 503, "UPSTREAM_ERROR")),
    ).toBe(false);
  });
});
