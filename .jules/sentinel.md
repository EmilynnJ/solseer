## 2026-08-13 - Path Parameter UUID Validation Enhancement
**Vulnerability:** Lack of UUID validation on path parameters (`:id`, `:readingId`, `:readerId`) across multiple Hono routes. If requests were made with malformed/invalid UUID formats, the queries/stored procedures failed with database syntax errors (500 Internal Server Error) instead of 400 Bad Request.
**Learning:** Raw template literal SQL queries (like those in `messages.ts` with `::uuid`) and Drizzle queries were casting/using raw string parameters directly. When PostgreSQL executed these with non-UUID values, it threw a syntax exception.
**Prevention:** Use a dedicated validation middleware (`validateUuidParams`) to validate all path parameters mapping to database UUID primary/foreign keys before the route handler executes, failing securely and early with a clean 400 Bad Request (`INVALID_UUID`) response.

## 2026-08-21 - Webhook Provider Payload Identifier Validation Relaxation
**Vulnerability:** External webhook payloads from RealtimeKit failed Zod validation with 400 Bad Request if the `participant.customParticipantId` field was omitted or contained non-UUID string identifiers, causing webhook processing to fail and state updates in DurableObjects to be missed.
**Learning:** External provider webhook schemas should strictly enforce structure without over-constraining optional or provider-controlled vendor identifiers as mandatory strict UUIDs.
**Prevention:** Validate external webhook participant IDs as flexible optional strings (`z.string().min(1).optional()`) so webhook delivery remains resilient while maintaining payload type safety.
