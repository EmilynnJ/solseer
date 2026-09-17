import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { logger } from "../src/lib/log";

describe("logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should log info messages correctly", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("Test info message", { requestId: "req-123" }, { extra: "data" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({
      timestamp: "2024-01-01T00:00:00.000Z",
      level: "info",
      message: "Test info message",
      requestId: "req-123",
      extra: "data"
    }));
  });

  it("should log warn messages correctly", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logger.warn("Test warn message", { userId: "user-456" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({
      timestamp: "2024-01-01T00:00:00.000Z",
      level: "warn",
      message: "Test warn message",
      userId: "user-456"
    }));
  });

  it("should log error messages correctly", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Test error message", undefined, { stack: "Error stack" });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({
      timestamp: "2024-01-01T00:00:00.000Z",
      level: "error",
      message: "Test error message",
      stack: "Error stack"
    }));
  });
});
