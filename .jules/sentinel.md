## 2026-08-20 - SSRF Prevention via Disallowing HTTP Redirects
**Vulnerability:** `downloadLimitedJson` verified allowed domains for chat transcript URLs, but passed `url` directly to `fetch` with default redirect-following behavior (`redirect: "follow"`). An attacker or compromised URL on an allowed domain could return a 301/302 redirect pointing to internal resources (e.g. cloud metadata endpoints) or unapproved domains, bypassing domain validation.
**Learning:** Checking hostnames on an initial URL string before calling `fetch` is insufficient when `fetch` follows redirects automatically.
**Prevention:** Always configure `fetch` with `redirect: "error"` (or validate redirect targets manually) when fetching user-supplied or external URLs.

## 2026-08-13 - Path Parameter UUID Validation Enhancement
**Vulnerability:** Lack of UUID validation on path parameters (`:id`, `:readingId`, `:readerId`) across multiple Hono routes. If requests were made with malformed/invalid UUID formats, the queries/stored procedures failed with database syntax errors (500 Internal Server Error) instead of 400 Bad Request.
**Learning:** Raw template literal SQL queries (like those in `messages.ts` with `::uuid`) and Drizzle queries were casting/using raw string parameters directly. When PostgreSQL executed these with non-UUID values, it threw a syntax exception.
**Prevention:** Use a dedicated validation middleware (`validateUuidParams`) to validate all path parameters mapping to database UUID primary/foreign keys before the route handler executes, failing securely and early with a clean 400 Bad Request (`INVALID_UUID`) response.
