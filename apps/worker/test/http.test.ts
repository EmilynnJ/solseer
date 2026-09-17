import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { boundedJson } from "../src/lib/http";
import { AppError } from "../src/lib/errors";

describe("boundedJson middleware", () => {
  it("allows JSON requests within the size limit", async () => {
    const app = new Hono();
    app.use("*", boundedJson(100));
    app.post("/", (c) => c.text("ok"));

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "50",
      },
      body: JSON.stringify({ a: 1 }),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rejects JSON requests exceeding the size limit with 413 PAYLOAD_TOO_LARGE", async () => {
    const app = new Hono();
    // Use an error handler to catch AppError
    app.onError((err, c) => {
      if (err instanceof AppError) {
        return c.json({ error: { code: err.code, message: err.message } }, err.status);
      }
      return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } }, 500);
    });
    app.use("*", boundedJson(100));
    app.post("/", (c) => c.text("ok"));

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "101",
      },
      // Using fake body just to satisfy fetch request API
      body: JSON.stringify({ a: 1 }),
    });

    expect(res.status).toBe(413);
    const body = await res.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(body.error.message).toContain("too large");
  });

  it("bypasses check for non-JSON content types", async () => {
    const app = new Hono();
    app.use("*", boundedJson(100));
    app.post("/", (c) => c.text("ok"));

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "200", // exceeds limit but shouldn't trigger error
      },
      body: "a".repeat(200),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("handles missing Content-Type header by bypassing the check", async () => {
    const app = new Hono();
    app.use("*", boundedJson(100));
    app.post("/", (c) => c.text("ok"));

    const res = await app.request("/", {
      method: "POST",
      // No Content-Type header
      headers: {
        "Content-Length": "200",
      },
      body: "a".repeat(200),
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("handles missing Content-Length by treating it as 0", async () => {
      const app = new Hono();
      app.use("*", boundedJson(100));
      app.post("/", (c) => c.text("ok"));

      const res = await app.request("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // In real world fetch might add it, but using Hono's app.request we can control headers
      });

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

  it("rejects invalid Content-Length value (e.g. non-numeric string)", async () => {
      const app = new Hono();
      app.onError((err, c) => {
        if (err instanceof AppError) {
          return c.json({ error: { code: err.code, message: err.message } }, err.status);
        }
        return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } }, 500);
      });
      app.use("*", boundedJson(100));
      app.post("/", (c) => c.text("ok"));

      const res = await app.request("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "invalid",
        },
      });

      expect(res.status).toBe(413); // Because Number("invalid") is NaN, and !Number.isFinite(NaN) is true
      const body = await res.json<{ error: { code: string; message: string } }>();
      expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    });
});
