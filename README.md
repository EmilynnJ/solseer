# SoulSeer Initial Launch

SoulSeer's initial public-launch monorepo for pay-per-minute chat, voice, and video readings plus the public community hub.

## Packages

- `apps/client` — React + Vite mobile-first frontend deployed to Vercel.
- `apps/worker` — Cloudflare Worker API, verified webhooks, R2 access, and one Durable Object per reading.
- `packages/shared` — Drizzle schema, Zod contracts, types, constants, and billing rules.

The initial launch intentionally excludes shop, livestreaming, virtual gifts, scheduled bookings, direct messages, push notifications, PWA/offline support, and AI features.

See [docs/SETUP.md](docs/SETUP.md) and [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md) before configuring providers or deploying.
