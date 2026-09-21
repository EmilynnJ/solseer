## 2026-08-13 - Path Parameter UUID Validation Enhancement
**Vulnerability:** Lack of UUID validation on path parameters (`:id`, `:readingId`, `:readerId`) across multiple Hono routes. If requests were made with malformed/invalid UUID formats, the queries/stored procedures failed with database syntax errors (500 Internal Server Error) instead of 400 Bad Request.
**Learning:** Raw template literal SQL queries (like those in `messages.ts` with `::uuid`) and Drizzle queries were casting/using raw string parameters directly. When PostgreSQL executed these with non-UUID values, it threw a syntax exception.
**Prevention:** Use a dedicated validation middleware (`validateUuidParams`) to validate all path parameters mapping to database UUID primary/foreign keys before the route handler executes, failing securely and early with a clean 400 Bad Request (`INVALID_UUID`) response.

## 2026-08-21 - Webhook Provider Payload Identifier Validation Relaxation
**Vulnerability:** External webhook payloads from RealtimeKit failed Zod validation with 400 Bad Request if the `participant.customParticipantId` field was omitted or contained non-UUID string identifiers, causing webhook processing to fail and state updates in DurableObjects to be missed.
**Learning:** External provider webhook schemas should strictly enforce structure without over-constraining optional or provider-controlled vendor identifiers as mandatory strict UUIDs.
**Prevention:** Validate external webhook participant IDs as flexible optional strings (`z.string().min(1).optional()`) so webhook delivery remains resilient while maintaining payload type safety.
## 2026-09-06 - Unsafe HTML Rendering in policy.tsx

**Vulnerability:** The `policy.tsx` component used `dangerouslySetInnerHTML={{ __html: html }}` to render HTML content from local files. While currently using local content, this pattern is generally unsafe as it leaves the application vulnerable to XSS if the content source is ever changed to include user input or untrusted API data.
**Learning:** `dangerouslySetInnerHTML` should only be used when absolutely necessary and always with sanitized input.
**Prevention:** Always use a sanitization library like `dompurify` when using `dangerouslySetInnerHTML`, even if the initial content seems safe, to prevent future vulnerabilities. Wrap the input like `DOMPurify.sanitize(html)`.

## 2026-09-21 - Unbounded Request Body Stream DoS Prevention in boundedJson
**Vulnerability:** The `boundedJson` middleware checked the `Content-Length` header if present, but allowed requests without a `Content-Length` header or with a spoofed small `Content-Length` to stream arbitrarily large JSON bodies, causing memory buffer Denial of Service (DoS).
**Learning:** Relying solely on `Content-Length` headers in middleware is insufficient because clients can omit headers, use `Transfer-Encoding: chunked`, or spoof `Content-Length`.
**Prevention:** Always inspect request body streams chunk-by-chunk using a reader (`getReader()`) to track accumulated bytes and cancel streams that exceed size limits (`maxBytes`).
