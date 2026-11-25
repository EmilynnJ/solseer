# SoulSeer security and observability rollout

This first-stage change adds consent-gated auth lifecycle analytics and correlates API logs with verified identities. It is not yet a complete audit system. Do not claim production coverage until synthetic tests are observed in each destination.

## Next deployment steps

- Render static site: verify the active deploy and VITE_POSTHOG_KEY/HOST against project 470315. Do not commit credentials. Change the PostHog project's application URL to https://soul-seer.net and verify a consented browser produces events.
- Add sanitized page navigation and explicit non-sensitive action events for public browsing, reading requests, wallet actions, messaging metadata and profile changes. Never send text, payment details, email, raw URLs or secrets. Check SDK default event properties for query strings and other sensitive metadata before production.
- Neon Auth: log export returned HTTP 404 on this project. Build a provider-authenticated, replay-resistant webhook for user.created, storing only provider user ID, event ID, timestamp and event type in an append-only restricted audit table. Do not enable before signature verification, deduplication, delivery/failure handling and staging tests. Do not subscribe to events carrying OTP or magic-link secrets. Add scheduled reconciliation of auth IDs lacking app profiles; alert on new unexpected records. Do not modify managed auth tables or block signup with an untested webhook.
- Cloudflare: confirm live Worker logs and retention; correlate server-verified identity and request ID with relevant business actions. Log route templates rather than raw paths; avoid headers, bodies, cookies and raw query strings. Extend durable audit records for authorization denials, profile creation, role changes, wallet changes, refunds, payout requests, and admin changes. Use a separate restricted role for audit readers. Apply a documented retention policy and review access.
- PostHog replay: optional, consented, public pages only, all inputs/text masked, no network payloads or console capture, no login/reset/payment/reading/message/admin routes. Do not enable globally before privacy review and testing.
- Sentry: verify both deployed projects, scrub sensitive data, disable request payloads and replay, alert on production errors.
- End-to-end acceptance: new test account without verification; direct auth registration; rejected sign-in; verified login; profile creation; denied API request; wallet sandbox operation. Verify timestamps/IDs in the right destinations, check no secrets or private content, and ensure production login/reading/payment flows still work.

Start with a short operational log retention (e.g. 30 days), document security audit retention separately, and align privacy notices and consent. Do not store raw passwords, codes, chat content, recordings of readings or payment credentials. Analytics is not evidence of identity by itself.
