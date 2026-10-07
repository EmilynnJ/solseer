# SoulSeer production setup

SoulSeer is a three-service production deployment: a Render Static Site serves the React client, Cloudflare runs the Worker, Durable Object, RealtimeKit integration, and R2 bucket, and Neon provides Auth and Postgres.

## 1. Prerequisites

- Node.js 22 or newer and npm 11 or newer
- A Neon project with separate development, staging, and production branches
- A Cloudflare account with Workers Paid, R2, and RealtimeKit enabled
- A Stripe account with Connect Express enabled
- A Render account (the frontend is a Render Static Site)

Run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` from the repository root.

## 2. Neon

Production database roles verified after the 2026-10-07 restore:

- `soulseer_app`: application data used by the Cloudflare Worker.
- `neondb`: Neon Auth's database. Keep it even if its application tables look empty.
- Client `VITE_NEON_AUTH_URL` and Worker `NEON_AUTH_ISSUER`:
  `https://ep-still-mud-aj5bg4yw.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth`
- Worker `NEON_AUTH_JWKS_URL`: the same URL with `/.well-known/jwks.json` appended.

The restore preserved these URLs. The deployed frontend and live Worker settings
were checked against them; no auth URL change was needed. Vite reads the client's
value at build time from Render's environment. The Worker production defaults are
in `apps/worker/wrangler.toml`.

1. Enable Neon Auth on each branch. Enable email/password and Google OAuth. Add the exact production origin (`https://soul-seer.net`) and the local origin to allowed origins and callback URLs.
2. Copy the branch-specific Auth URL, issuer, and JWKS URL. The browser gets only the Auth URL; issuer and JWKS stay in the Worker.
3. Use a pooled server connection string for `DATABASE_URL`.
4. Run `DATABASE_URL="..." npm run db:migrate` against development, then staging, then production. Never edit Neon Auth-owned schemas.
5. Verify RLS using separate client, Reader, and Admin JWT claims before launch.

## 3. Cloudflare

1. Create `soulseer-profile-images-dev`, `soulseer-profile-images-staging`, and `soulseer-profile-images` R2 buckets. Enable lifecycle cleanup for abandoned temporary objects.
2. Create separate RealtimeKit Apps for development, staging, and production. Create `soulseer-client` and `soulseer-reader` presets for chat, audio, and video permissions. Only server-side actions may end a session for everyone.
3. Register the Worker webhook URL `/api/webhooks/realtimekit` for `meeting.started`, `meeting.ended`, `meeting.participantJoined`, `meeting.participantLeft`, and `meeting.chatSynced`.
4. Review Worker names, bucket names, origins, routes, and rate-limit namespace IDs in `apps/worker/wrangler.toml` for each environment. Production uses the `seer` R2 bucket and `api.soul-seer.net` Custom Domain.
5. Set Worker secrets with `wrangler secret put NAME --env production` for every secret listed in `.env.example`. Use a randomly generated, 32-byte-or-longer `UPLOAD_SIGNING_SECRET`.
6. Generate bindings with `npm run cf:types`, exercise the reading lifecycle locally or in staging, and deploy production with `npm run deploy:worker` only after every required secret is present.

## 4. Stripe

1. Add the production webhook endpoint `/api/webhooks/stripe` and subscribe to `payment_intent.succeeded`, `account.updated`, `transfer.created`, and `transfer.reversed`.
2. Store the webhook signing secret and secret API key in Cloudflare secrets. Set only the publishable key as a `VITE_` environment variable on the Render Static Site.
3. Complete Connect platform settings, branding, support contact, and Express onboarding. Payouts remain manual and Admin-only for this launch.
4. Test top-up success, duplicate webhook delivery, refund, Connect onboarding, payout threshold, transfer reversal, and webhook signature failure with Stripe test mode before enabling live keys.

## 5. Frontend hosting (Render)

The frontend is the Render Static Site `solseer`, deployed from the `main` branch.

1. Root directory: blank (repository root).
2. Build command: `npm ci && npm run build -w @soulseer/shared && npm run build -w @soulseer/client`
3. Publish directory: `apps/client/dist`
4. Environment: set every `VITE_` variable from `.env.example`. `VITE_API_ORIGIN` must be the production Worker origin (`https://api.soul-seer.net`) without a trailing slash. Never put server secrets in `VITE_` variables.
5. Redirects/Rewrites: add one rule with Source `/*`, Destination `/index.html`, Action **Rewrite** (not Redirect). Render serves existing files such as `/assets/*` before applying the rule, so the app's routes load on a direct visit or refresh.
6. Headers: add these for path `/*`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`.
7. Custom domain: `soul-seer.net`.

The former Vercel deployment, client configuration, and analytics integration have been removed. Manage frontend rewrites and headers in Render.

### Diagnosing sign-in database errors

`VITE_NEON_AUTH_URL` identifies the database used by Neon Auth. The Worker's
`DATABASE_URL` identifies the application database; they do not have to be the
same database. If Neon Auth reports "Database is unavailable or has been
deleted", inspect the current production branch's Auth configuration and database
availability. Copy the verified Auth URL into Render and rebuild the client if
it differs from the deployed URL. Keep the Worker's verified issuer and JWKS
configuration aligned with that same Auth service. Do not substitute an
application database name into an Auth URL or recreate the auth database to
silence the error; existing users and sessions belong to the configured Auth
database.

## 6. Seed the first Admin

Create the identity through Neon Auth, bootstrap the app profile once, and promote that app user to `admin` through a reviewed, one-time SQL operation in the Neon console. Do not expose a promotion endpoint. Record the operator and ticket outside the application audit trail.

Reader accounts must be invited from the Admin Dashboard. Never send a permanent password.
