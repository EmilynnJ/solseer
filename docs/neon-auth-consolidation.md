# SoulSeer production database and Auth consolidation

## Current production state — October 16, 2026

Production Managed Better Auth now targets **soulseer_app** on **Tables** (`br-young-butterfly-ajfc2kgc`) in project `gentle-night-21877985`.

- Auth base URL: `https://ep-still-mud-aj5bg4yw.neonauth.c-3.us-east-2.aws.neon.tech/soulseer_app/auth`
- JWKS: Auth base URL + `/.well-known/jwks.json`
- Frontend: Render `solseer`, service `srv-db0t5tad0e5s73d3njeg`, serving `https://soul-seer.net`.
- API: Cloudflare `soulseer-api`, serving `https://api.soul-seer.net`.
- Worker `DATABASE_URL` explicitly targets production `soulseer_app`. Its issuer and JWKS bindings match the new Auth service.
- The original `neondb` database, Auth records, legacy tables, and framework metadata remain intact as recovery sources.

## Integrity evidence

The secure same-branch transfer copied six Auth identities, six credential/OAuth accounts, seven sessions, two verification rows, and the original signing-key material. Empty organization/member/invitation tables were verified as well.

The six original Auth user IDs and all credential/provider association fields match the source. Imported signing keys retain their original IDs, public keys, and encrypted private keys; their signing expiration was intentionally set at cutover. Managed Auth then created its own encryption-compatible active key. The production JWKS contains the preserved old key and the new active key.

Row-content fingerprints of **all 22 application tables** matched before and after cutover, including:

| Records | Count |
| --- | ---: |
| Application users | 12 |
| Reader profiles | 9 |
| Wallets | 12 |
| Wallet ledger entries | 6 |
| Reading sessions | 8 |
| Reading events | 11 |
| Pending payouts | 9 |

No application profile IDs, Auth mappings, roles, reader approvals, wallet ownership, or financial records were changed.

## Recovery points

- Original checkpoint: `br-plain-sunset-ajdmkvlc` (October 13).
- Fresh production checkpoint: `br-patient-salad-ajtuo5o1`, created October 16 at 18:13:37 UTC. Both databases and the expected Auth/application counts were verified.
- Fresh full-transfer rehearsal: `br-square-wind-ajuo43e8`.
- Original rehearsal: `br-old-butterfly-ajmy67sa`.

An empty schema left by a failed managed-provision attempt was preserved in production `soulseer_app` as `neon_auth_provision_attempt_20261016`. It contains no users/accounts/sessions. Nothing was dropped to resolve the provisioning conflict.

## Verification results

| Check | Result |
| --- | --- |
| Existing rehearsal transfer and reruns | PASS; original records preserved |
| Fresh rehearsal into empty Auth tables | PASS; complete transfer |
| Synthetic password signup/sign-in on rehearsal | PASS |
| Rehearsal session retrieval and JWT issuance | PASS, HTTP 200 |
| Rehearsal JWT signature and subject | PASS against its JWKS |
| Unverified rehearsal identity at Worker | Correct HTTP 403 `EMAIL_NOT_VERIFIED` |
| Full frontend regression suite | 56 passed |
| Focused Worker JWT tests | 3 passed |
| Production Managed Auth database | Confirmed `soulseer_app` |
| Production signing-key use | Signature verified using anonymous-token endpoint; no production test identity created |
| Production API health | HTTP 200 |
| Missing/invalid API bearer tokens | Correct HTTP 401 |
| Production Render rebuild | Live, deploy `dep-db96n56q1p3s73apqev0`, October 16 at 18:23:56 UTC |
| Live frontend Auth chunk | New `soulseer_app/auth` URL and `.token()`; no old `neondb/auth` URL |
| Cloudflare deployed version | `8f04e92a-ec04-4945-b031-8696a4d21411`, 100% traffic |
| Real reader/admin dashboard login after cutover | Not verified |
| Production onboarding/reset delivery | Not verified |

GitHub Actions' crawler workflow reported `startup_failure` and did not execute its checks. The broader local Worker run was limited by native filesystem/sandbox and shared-dependency resolution problems; it is not reported as a full pass. No Worker application code was changed for production; its existing deployed code was retained and only the three Auth/database bindings were updated.

## Remaining account state

Migration preserves existing account state. Two source reader Auth identities have unverified email and only password-provider associations. One reported reader's existing Auth ID correctly matches its application account, but Google is not linked. Its reader approval state is separate and was preserved. Use the existing password/verification flow and supported authenticated provider linking; do not mark email verified or relink identities merely from matching email.

Three Auth identities match application subjects. Nine application profiles lack an exact corresponding current Auth identity; this does not establish that identities were deleted. No recovery identities were invented.

Existing browser sessions require fresh sign-in after re-provisioning. This database migration is complete; full launch/login/onboarding readiness is not asserted.

## Reviewed migration utility

`scripts/migrate-neon-auth.mjs` requires private source/target URLs supplied through secure local environment injection. Never put connection strings, credential records, session cookies, or private keys in chat, logs, source control, or command history.

For a fresh non-production rehearsal, provision Managed Auth into `soulseer_app` using `delete_data=false` when disabling the previous integration. Source and target must be `neondb` and `soulseer_app` on the **same compute/branch**.

```text
node scripts/migrate-neon-auth.mjs --check
node scripts/migrate-neon-auth.mjs --apply --renew-signing-keys
```

The utility checks schema compatibility, refuses identity/credential conflicts, locks target Auth tables, stages typed records, and asserts row equality inside the transaction. Target-only transient verification rows are preserved. It preserves the destination's managed project ID and endpoint ID while transferring provider/email/plugin configuration.

Private signing keys are encrypted under the managed service's secret. Copying the old encrypted key alone caused live rehearsal `/token` and `/get-session` HTTP 500 responses. The tested renewal retains old key material and expires its signing use, causing Managed Auth to mint a valid new key. Do not disable private-key encryption. Reference: [Better Auth JWT documentation](https://better-auth.com/docs/plugins/jwt).

After the destination becomes active, new identities/sessions/keys can differ from the retained source. The utility deliberately refuses those conflicts; do not blindly rerun it against an active production destination.

## Recovery procedure

The original source and checkpoints are preserved. No destructive branch restore or database drop was performed.

Rollback has not been exercised end to end. Before reverting the managed integration, secure a fresh checkpoint of current production, account for any new Auth writes since cutover, and use `delete_data=false`. Re-provisioning can issue a different URL and can reject an existing `neon_auth` schema. Preserve such a schema under a separate name rather than dropping it; transfer its records into the newly provisioned schema using a reviewed secure transaction and renew managed signing keys. Recheck the actual Auth URL/JWKS, provider callbacks, Render build-time URL, and Worker settings. Never assume a previous URL or symmetric encryption secret is restored automatically.
