# SoulSeer launch gate

Production may launch only when every item below is checked in staging and repeated against production configuration where safe.

## Identity and permissions

- [ ] Email signup, email verification, sign-in, sign-out, password reset, and Google OAuth succeed.
- [ ] First-login profile bootstrap is transactional; Reader invites cannot create Client or Admin roles.
- [ ] Suspended and deleted accounts are rejected by every protected endpoint.
- [ ] Client, Reader, and Admin cross-role route attempts return 403.
- [ ] Data export and account deletion work; deletion is rejected while a reading is active.
- [ ] RLS denial tests cover another Client's wallet, readings, reviews, and forum-owned records.

## Money and payouts

- [ ] Stripe Payment Element completes $5 minimum plus $10, $25, $50, and $100 presets.
- [ ] Only a verified `payment_intent.succeeded` webhook credits a wallet.
- [ ] Duplicate payment, billing, refund, and payout events do not change balances twice.
- [ ] Simultaneous reading requests cannot overspend a wallet or double-book a Reader.
- [ ] Every charge applies the integer-cent 70/30 split and append-only ledger records reconcile.
- [ ] Refunds, $15 payout threshold, Connect onboarding, successful payout, failure, and reversal are verified.

## Live readings

- [ ] Chat, voice, and video connect with the correct participant preset and internal UUID identity.
- [ ] Billing begins only after both assigned participants are present.
- [ ] Durable Object alarm retry and object restart do not double-charge.
- [ ] Low balance ends safely without a negative wallet.
- [ ] Disconnect pauses future billing after the earned boundary; reconnect within two minutes resumes; grace expiry ends.
- [ ] Explicit end, browser exit, device denial, provider failure, and webhook reordering finalize correctly.
- [ ] Meeting is made inactive after completion and old tokens cannot reopen it.
- [ ] Chat replay imports within the size cap and expires under the documented 90-day policy.

## Community and administration

- [ ] Public users can read, authenticated users can post/comment/flag, one-level reply depth is enforced, and only Admins announce.
- [ ] Hidden/deleted content disappears; every moderation action has an actor and timestamp.
- [ ] Reader invite, approval, suspension, profile image replacement/cleanup, rates, heartbeat, and history work.
- [ ] Admin user, reading, ledger, balance adjustment, refund, payout, Connect, and moderation controls are server-role protected.

## Security, accessibility, and operations

- [ ] Exact-origin CORS, request limits, rate limits, security headers, signature forgery tests, and production-safe errors pass.
- [ ] No secret, auth token, participant token, card data, email participant ID, or plaintext password appears in logs or client bundles.
- [ ] Dependency audit exceptions in `security_best_practices_report.md` have current owner review.
- [ ] Keyboard navigation, visible focus, labels, error announcements, reduced motion, contrast, and zoom to 200% pass.
- [ ] Every public and authenticated screen passes at 375px, 768px, and 1280px.
- [ ] Cloudflare logs/alerts cover webhook failures, billing lag, connection failures, refund rate, and payout failures.
- [ ] Database backup/restore, incident contacts, privacy requests, and support escalation have been rehearsed.
