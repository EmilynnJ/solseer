import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { boundedJson } from "../src/lib/http";
import { errorResponse } from "../src/lib/errors";

describe("boundedJson middleware", () => {
  it("enforces payload size limits based on Content-Length", async () => {
    const app = new Hono();
    app.use("*", boundedJson(65536));
    app.post("/test", (c) => c.text("ok"));
    app.onError((err, c) => errorResponse(err, c));

    // Test missing Content-Length (empty body)
    let res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(res.status).toBe(200);

    // Test length 0
    res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "0",
      },
    });
    expect(res.status).toBe(200);

    // Test exact boundary
    res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "65536",
      },
    });
    expect(res.status).toBe(200);

    // Test over boundary
    res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "65537",
      },
    });
    expect(res.status).toBe(413);

    // Test invalid Content-Length
    res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "invalid",
      },
    });
    expect(res.status).toBe(413);
  });

  it("ignores non-JSON requests", async () => {
    const app = new Hono();
    app.use("*", boundedJson(65536));
    app.post("/test", (c) => c.text("ok"));

    const res = await app.request("/test", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Content-Length": "9999999", // Way over limit
      },
    });
    expect(res.status).toBe(200);
  });
});
