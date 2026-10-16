# SoulSeer Neon Auth consolidation: controlled cutover

**Project:** gentle-night-21877985

**Protected production branch:** Tables (`br-young-butterfly-ajfc2kgc`)

**Recovery checkpoint:** soulseer-auth-consolidation-safety-20261012 (`br-plain-sunset-ajdmkvlc`)

**Isolated rehearsal branch:** soulseer-auth-consolidation-rehearsal-20261012 (`br-old-butterfly-ajmy67sa`)

## Expected layout

| | Source | Destination |
|---|---|---|
| Database | `neondb` | `soulseer_app` |
| Auth schema | `neon_auth` | `neon_auth` |
| Business tables | not used | existing `public.users`, `public.reader_profiles`, wallets |

**Never drop either database or overwrite existing SoulSeer user, reader, wallet or reading tables.**

## What has already been done on rehearsal

- Isolated recovery branch and rehearsal branch created.
- Neon Auth disabled **only on rehearsal** using `delete_data=false`.
- Neon Auth re-provisioned **only on rehearsal** against `soulseer_app`.
- Six `neon_auth.user` rows staged in the rehearsal destination, with unchanged IDs.
- Sensitive account associations, signing keys and session data have **not** been copied yet.
- Production remains unchanged.

## Finish isolated rehearsal (Windows PowerShell)

1. Choose **soulseer-auth-consolidation-rehearsal-20261012** in Neon Console.
2. Obtain its connection string for `neondb` (source) and `soulseer_app` (destination), both on **that same rehearsal branch**. Do not share these connection strings by chat or in a Git commit.
3. On a trusted computer in your SoulSeer checkout, run:

```powershell
git fetch origin
git switch fix/neon-auth-consolidation
npm install
$source = Read-Host 'Rehearsal neondb connection string' -AsSecureString
$target = Read-Host 'Rehearsal soulseer_app connection string' -AsSecureString
$env:SOULSEER_AUTH_SOURCE_URL = [System.Net.NetworkCredential]::new('', $source).Password
$env:SOULSEER_AUTH_TARGET_URL = [System.Net.NetworkCredential]::new('', $target).Password
node scripts/migrate-neon-auth.mjs --check
node scripts/migrate-neon-auth.mjs --apply
Remove-Item Env:SOULSEER_AUTH_SOURCE_URL,Env:SOULSEER_AUTH_TARGET_URL
```

The migration refuses cross-branch host mismatches and unexpected destination records. It never prints credentials. It copies Auth records and related provider configuration without changing existing app profile IDs. Review the output for **AUTH DATA COPY VERIFIED** and confirm all source records match target.

**Rehearsal sign-in test:** use the rehearsal Auth URL and a separate preview deployment (not the live domain). Verify one existing password account, one Google account, admin role, reader role, and JWT-backed `/api/auth/me`. Google OAuth redirect URI must be authorized for the new Auth endpoint. If testing exposes a problem, stop here and preserve the checkpoint branch.

## Production cutover (ONLY after successful rehearsal)

1. Stop new sign-ins briefly. Confirm the production Auth source counts and retain the recovery branch.
2. Disable **production** Managed Better Auth with **`delete_data=false`** only. **Never use `delete_data=true`.** This must not delete the old `neon_auth` tables.
3. Provision Managed Better Auth on the same production branch with `database_name=soulseer_app`.
4. Retrieve both connection strings on the production branch and execute the same `--check` then `--apply` script locally. Do not point the script at different branches.
5. Verify source and destination record equality and SoulSeer profile matching. Preserve `neondb` as rollback source.
6. Set Render `VITE_NEON_AUTH_URL` to the new production Auth base URL; ensure the deployed React code uses `authClient.token()` for the Cloudflare API.
7. Set Cloudflare Worker `NEON_AUTH_ISSUER` to the new Auth base URL and `NEON_AUTH_JWKS_URL` to its matching `/.well-known/jwks.json`; redeploy the Worker. Keep `DATABASE_URL` pointing at `soulseer_app`.
8. Configure the Google OAuth redirect URI for the **new** Auth base URL. Reconfirm trusted frontend origins and email verification configuration.
9. Test password login, Google login, admin and reader dashboards, and `/api/auth/me`. Old browser sessions may need fresh login.
10. Resolve readers lacking auth identities with verified, ID-preserving account recovery. **Do not delete or duplicate reader profiles**.

## Rollback

The old `neondb.neon_auth` data remains untouched after disabling Auth. If the new Auth service fails, stop sign-ins, disable the new integration using `delete_data=false`, re-provision against `neondb`, and revert frontend/Cloudflare Auth URLs after verifying the old service. Use the safety branch for a separate verified recovery source, not an automatic destructive branch restore.

## Known limitation

Neon currently offers no verified one-click cross-database relocation for Managed Better Auth. The API provisions it in the desired database but does not itself migrate credential records. A migration script must transfer sensitive records over an authorized local connection. Do not move password hashes, OAuth tokens or private signing keys through a chat message.

## Rehearsal validation on October 16, 2026

- The live rehearsal had already received six users, six account rows, six sessions, and one signing-key row before this run. The historical handoff's partial-copy counts were stale.
- Corrected the frontend SDK configuration: credentialed fetch options belong inside `BetterAuthReactAdapter(...)`. Top-level `fetchOptions` caused the Render preview build to fail with TS2353.
- Migration preflight now checks matching column types/nullability. Application of records locks Auth tables, stages typed records, rejects conflicts, and verifies inserted records inside the transaction so a mismatch rolls back the transfer.
- Target-only transient verification rows are preserved. Shared verification IDs and every identity, credential, provider association, signing key, and session must match exactly.
- `--check` and two idempotent `--apply` runs passed on rehearsal. Source: six users, six accounts, six sessions, one signing-key row, two verification rows. Destination retains the two source verification rows and two additional rehearsal verification rows.
- Row-content fingerprints of all 22 application tables were identical before/after, including 12 users, nine reader profiles, 12 wallets, six ledger entries, and eight reading sessions. No profile/financial records were changed.
- Rehearsal public JWKS returned HTTP 200 with one key.
- Frontend type-check passed. Focused client auth/invitation/reset tests: 18 passed. Worker JWT tests: three passed.
- Isolated API: `https://soulseer-auth-rehearsal.emilynn.workers.dev`, bound only to rehearsal `soulseer_app`; no production payment, RealtimeKit, or image-storage credentials are installed there.
- Preview frontend: `https://solseer-pr-243.onrender.com`; its Auth URL and API origin point to rehearsal.
- **Production is unchanged. Real password and Google sign-in, correct reader/admin profiles, new-reader onboarding, and the production cutover remain gated on actual end-to-end results.**
- Migration copies source trusted origins. Add the preview origin again using the supported Neon domain API after any migration rerun.
