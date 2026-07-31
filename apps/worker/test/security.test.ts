import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("API security boundaries", () => {
  it("rejects an unapproved browser origin", async () => {
    const response = await SELF.fetch("https://api.example.test/api/health", {
      headers: { Origin: "https://attacker.example" },
    });
    expect(response.status).toBe(403);
    const body = await response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("echoes an approved browser origin in CORS responses", async () => {
    const origin = "http://127.0.0.1:5173";
    const response = await SELF.fetch("https://api.example.test/api/health", {
      headers: { Origin: origin },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("answers preflight requests for an approved browser origin", async () => {
    const origin = "http://127.0.0.1:5173";
    const response = await SELF.fetch("https://api.example.test/api/forum/posts", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("requires authentication for Admin operations", async () => {
    const response = await SELF.fetch("https://api.example.test/api/admin/users");
    expect(response.status).toBe(401);
    const body = await response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejects unsigned payment webhooks", async () => {
    const response = await SELF.fetch("https://api.example.test/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
    const body = await response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("MISSING_SIGNATURE");
  });

  it("sets defensive response headers", async () => {
    const response = await SELF.fetch("https://api.example.test/api/health");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  });
});
