# SoulSeer production setup

SoulSeer is a three-service production deployment: Vercel serves the React client, Cloudflare runs the Worker, Durable Object, RealtimeKit integration, and R2 bucket, and Neon provides Auth and Postgres.

## 1. Prerequisites

- Node.js 22 or newer and npm 11 or newer
- A Neon project with separate development, staging, and production branches
- A Cloudflare account with Workers Paid, R2, and RealtimeKit enabled
- A Stripe account with Connect Express enabled
- A Vercel project rooted at `apps/client`

Run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` from the repository root.

## 2. Neon

1. Enable Neon Auth on each branch. Enable email/password and Google OAuth. Add the exact Vercel origin and local origin to allowed origins and callback URLs.
2. Copy the branch-specific Auth URL, issuer, and JWKS URL. The browser gets only the Auth URL; issuer and JWKS stay in the Worker.
3. Use a pooled server connection string for `DATABASE_URL`.
4. Run `DATABASE_URL="..." npm run db:migrate` against development, then staging, then production. Never edit Neon Auth-owned schemas.
5. Verify RLS using separate client, Reader, and Admin JWT claims before launch.

## 3. Cloudflare

1. Create `soulseer-profile-images-dev`, `soulseer-profile-images-staging`, and `soulseer-profile-images` R2 buckets. Enable lifecycle cleanup for abandoned temporary objects.
2. Create separate RealtimeKit Apps for development, staging, and production. Create `soulseer-client` and `soulseer-reader` presets for chat, audio, and video permissions. Only server-side actions may end a session for everyone.
3. Register the Worker webhook URL `/api/webhooks/realtimekit` for `meeting.started`, `meeting.ended`, `meeting.participantJoined`, `meeting.participantLeft`, and `meeting.chatSynced`.
4. Replace example Worker names, bucket names, origins, and rate-limit namespace IDs in `apps/worker/wrangler.jsonc` for each environment.
5. Set Worker secrets with `wrangler secret put NAME --env production` for every secret listed in `.env.example`. Use a randomly generated, 32-byte-or-longer `UPLOAD_SIGNING_SECRET`.
6. Generate bindings with `npm run cf:types`, deploy staging, exercise the reading lifecycle, and only then deploy production.

## 4. Stripe

1. Add the production webhook endpoint `/api/webhooks/stripe` and subscribe to `payment_intent.succeeded`, `account.updated`, `transfer.created`, and `transfer.reversed`.
2. Store the webhook signing secret and secret API key in Cloudflare secrets. Set only the publishable key in Vercel.
3. Complete Connect platform settings, branding, support contact, and Express onboarding. Payouts remain manual and Admin-only for this launch.
4. Test top-up success, duplicate webhook delivery, refund, Connect onboarding, payout threshold, transfer reversal, and webhook signature failure with Stripe test mode before enabling live keys.

## 5. Vercel

Set every `VITE_` variable from `.env.example`. `VITE_API_ORIGIN` must be the production Worker origin without a trailing slash. Deploy from `apps/client`; its `vercel.json` includes SPA rewrites and defensive headers.

## 6. Seed the first Admin

Create the identity through Neon Auth, bootstrap the app profile once, and promote that app user to `admin` through a reviewed, one-time SQL operation in the Neon console. Do not expose a promotion endpoint. Record the operator and ticket outside the application audit trail.

Reader accounts must be invited from the Admin Dashboard. Never send a permanent password.
