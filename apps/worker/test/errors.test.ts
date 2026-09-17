import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, errorResponse } from "../src/lib/errors";

vi.mock("../src/lib/log", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockContext(): Context {
  return {
    get: vi.fn().mockImplementation((key) => {
      if (key === "requestId") return "req-123";
      return undefined;
    }),
    req: {
      url: "https://api.example.com/api/test",
    },
    json: vi.fn().mockImplementation((data: unknown, status: number) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  } as unknown as Context;
}

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

describe("errorResponse", () => {
  it("handles AppError correctly", async () => {
    const ctx = createMockContext();
    const error = new AppError(404, "NOT_FOUND", "Resource not found", {
      id: "123",
    });

    const response = errorResponse(error, ctx);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          requestId: "req-123",
          details: { id: "123" },
        },
      },
      404,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body as ErrorResponseBody).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        requestId: "req-123",
        details: { id: "123" },
      },
    });
  });

  it("handles AppError without details correctly", async () => {
    const ctx = createMockContext();
    const error = new AppError(401, "UNAUTHORIZED", "Missing credentials");

    const response = errorResponse(error, ctx);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body as ErrorResponseBody).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing credentials",
        requestId: "req-123",
      },
    });
    expect((body as ErrorResponseBody).error.details).toBeUndefined();
  });

  it("handles ZodError correctly", async () => {
    const ctx = createMockContext();
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({});
    const error = !result.success
      ? result.error
      : new Error("Should be ZodError");

    const response = errorResponse(error, ctx);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body as ErrorResponseBody).error.code).toBe("VALIDATION_ERROR");
    expect((body as ErrorResponseBody).error.message).toBe(
      "The request contains invalid fields.",
    );
    expect((body as ErrorResponseBody).error.requestId).toBe("req-123");
    expect((body as ErrorResponseBody).error.details).toBeDefined();
  });

  it("handles generic Error correctly", async () => {
    const ctx = createMockContext();
    const error = new Error("Something went terribly wrong");

    const response = errorResponse(error, ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect((body as ErrorResponseBody).error.code).toBe("INTERNAL_ERROR");
    expect((body as ErrorResponseBody).error.message).toBe(
      "The request could not be completed.",
    );
    expect((body as ErrorResponseBody).error.requestId).toBe("req-123");
    expect((body as ErrorResponseBody).error.details).toBeUndefined();
  });

  it("handles non-Error objects correctly", async () => {
    const ctx = createMockContext();
    const error = "just a string error";

    const response = errorResponse(error, ctx);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect((body as ErrorResponseBody).error.code).toBe("INTERNAL_ERROR");
    expect((body as ErrorResponseBody).error.message).toBe(
      "The request could not be completed.",
    );
    expect((body as ErrorResponseBody).error.requestId).toBe("req-123");
  });
});
