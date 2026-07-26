# SoulSeer security review

## Executive summary

The application uses server-side role checks, exact-origin CORS, short-lived provider tokens, verified webhooks, generated R2 object keys, byte-level image validation, integer financial transactions, and idempotent Durable Object billing. No application-authored critical or high-severity vulnerability remains from this review. Production launch is still conditional on provider configuration, RLS denial testing against a real Neon branch, and review of upstream package advisories below.

## Critical

No application-authored critical findings.

## High

No application-authored high findings.

## Moderate

### SEC-001 — Upstream Neon Auth client dependency advisories

`@neondatabase/neon-js@0.6.2-beta` currently pins `@neondatabase/auth@0.4.2-beta`, which installs `better-auth@1.4.18`. npm reports server-side Better Auth advisories, including OAuth/OIDC provider issues. SoulSeer does not deploy the Better Auth server code from this dependency: Neon runs the managed Auth service, while the Vite bundle uses its browser client. Forcing `better-auth@1.6.x` would violate Neon's tested dependency graph and was therefore rejected. Before launch, confirm the managed Neon Auth service is patched and upgrade the Neon SDK as soon as Neon publishes a compatible release.

### SEC-002 — Upstream RealtimeKit UUID advisory

`@cloudflare/realtimekit-react@2.0.1` pins `uuid@8.3.2`, which npm flags for an optional-buffer bounds issue in UUID v3/v5/v6. SoulSeer does not call those UUID APIs and uses platform `crypto.randomUUID()` for its own identifiers. Do not force a semver-major transitive replacement inside the media SDK; upgrade with Cloudflare's next compatible release.

### SEC-003 — React Router RSC advisory is outside the deployed mode

`react-router@7.18.1` is flagged for a React Server Components action-processing issue. SoulSeer is a static Vite SPA using `BrowserRouter`; it does not enable React Router framework/RSC mode or server actions. Track the advisory and upgrade when a patched stable browser package is published.

## Development-only

`drizzle-kit` retains an old nested `esbuild` advisory affecting a development server. Drizzle Kit is a migration-generation tool only and is not shipped in either production artifact. Do not expose its development server to untrusted networks.

## Required deployment verification

- Run forged Stripe and RealtimeKit webhook tests against staging.
- Run RLS allow/deny tests with real Neon Auth JWTs for all roles.
- Confirm Cloudflare and Vercel secrets, exact origins, logs, rate-limit namespaces, and retention policies.
- Re-run `npm audit --omit=dev` immediately before launch and after every provider SDK upgrade.
