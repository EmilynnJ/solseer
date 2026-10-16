/**
 * SoulSeer Managed Better Auth cross-database transfer.
 *
 * Run locally, never in a web browser or a Cloudflare Worker.
 * Connection strings come from Neon and stay on the operator's computer.
 * This program never prints credentials, password hashes, OAuth tokens,
 * session cookies, email addresses, or JWT private keys.
 *
 * Source: neondb.neon_auth on the SAME Neon project/branch.
 * Target: soulseer_app.neon_auth, AFTER Neon Auth has been provisioned for
 * soulseer_app (disable previous integration with delete_data=false first).
 *
 * npm install
 * $env:SOULSEER_AUTH_SOURCE_URL = "<Neon connection string for neondb>"
 * $env:SOULSEER_AUTH_TARGET_URL = "<Neon connection string for soulseer_app>"
 * node scripts/migrate-neon-auth.mjs --check
 * node scripts/migrate-neon-auth.mjs --apply
 *
 * For production, first run and validate this exact process on a test branch.
 */
import { neon } from "@neondatabase/serverless";

class MigrationSafetyError extends Error {}

const mode = process.argv[2] ?? "--check";
if (!["--check", "--apply"].includes(mode)) {
  throw new MigrationSafetyError("Usage: node scripts/migrate-neon-auth.mjs [--check|--apply]");
}
const sourceUrl = process.env.SOULSEER_AUTH_SOURCE_URL;
const targetUrl = process.env.SOULSEER_AUTH_TARGET_URL;
if (!sourceUrl || !targetUrl) {
  throw new MigrationSafetyError("Set SOULSEER_AUTH_SOURCE_URL and SOULSEER_AUTH_TARGET_URL in your local environment. Do not paste them into chat, logs, or GitHub.");
}

const source = neon(sourceUrl);
const target = neon(targetUrl);
// Both database URLs must belong to the same Neon compute/branch.
// Accept pooled and direct hostname variants of the same endpoint.
const endpointHost = (uri) => new URL(uri).hostname.replace("-pooler.", ".");
if (endpointHost(sourceUrl) !== endpointHost(targetUrl)) {
  throw new MigrationSafetyError("Source and target URLs point to different Neon compute endpoints. Refusing cross-branch migration.");
}
const order = [
  "user",
  "organization",
  "account",
  "member",
  "invitation",
  "jwks",
  "session",
  "verification",
];
const jsonValue = (value) => value == null ? null : JSON.stringify(value);
const tableName = (table) => `neon_auth."${table}"`;

async function dbName(db) {
  const result = await db`SELECT current_database() AS name`;
  return result[0]?.name;
}

async function getRows(db, table) {
  // The identifier comes only from the constant table allowlist above.
  const result = await db.query(
    `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) AS data FROM ${tableName(table)} t`
  );
  const value = result[0]?.data ?? [];
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function getConfig(db) {
  const rows = await db`
    SELECT id, name, endpoint_id, trusted_origins, social_providers,
           email_provider, email_and_password, allow_localhost,
           plugin_configs, webhook_config
    FROM neon_auth.project_config
  `;
  if (rows.length !== 1) {
    throw new MigrationSafetyError("Expected exactly one Auth configuration row in each database.");
  }
  return rows[0];
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])])
    );
  }
  return value;
}

function sameRecord(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function insertQuery(table, records) {
  // Use parameterized JSON, not string interpolation for credential data.
  const payload = JSON.stringify(records);
  switch (table) {
    case "user":
      return target`INSERT INTO neon_auth."user" SELECT * FROM jsonb_populate_recordset(NULL::neon_auth."user", ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "organization":
      return target`INSERT INTO neon_auth.organization SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.organization, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "account":
      return target`INSERT INTO neon_auth.account SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.account, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "member":
      return target`INSERT INTO neon_auth.member SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.member, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "invitation":
      return target`INSERT INTO neon_auth.invitation SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.invitation, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "jwks":
      return target`INSERT INTO neon_auth.jwks SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.jwks, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "session":
      return target`INSERT INTO neon_auth.session SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.session, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    case "verification":
      return target`INSERT INTO neon_auth.verification SELECT * FROM jsonb_populate_recordset(NULL::neon_auth.verification, ${payload}::jsonb) ON CONFLICT DO NOTHING`;
    default:
      throw new MigrationSafetyError("Unexpected Auth table.");
  }
}

async function main() {
  const [sourceName, targetName] = await Promise.all([
    dbName(source),
    dbName(target),
  ]);
  if (sourceName !== "neondb" || targetName !== "soulseer_app") {
    throw new MigrationSafetyError("Wrong database target. Expected neondb -> soulseer_app. Nothing changed.");
  }

  const schemas = await Promise.all([source, target].map(db => db`
    SELECT table_name, column_name, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'neon_auth'
    ORDER BY table_name, ordinal_position
  `));
  if (!sameRecord(schemas[0], schemas[1])) {
    throw new MigrationSafetyError("Auth schemas differ. Refusing type conversion or missing-column data loss.");
  }

  const expected = new Map();
  const counts = [];
  for (const table of order) {
    const sourceRows = await getRows(source, table);
    const targetRows = await getRows(target, table);
    const byId = new Map(sourceRows.map((row) => [row.id, row]));
    for (const current of targetRows) {
      const original = byId.get(current.id);
      // The managed service may create fresh OAuth/OTP verification records.
      // Preserve these target-only transient rows; shared IDs must still match.
      if ((!original && table !== "verification") ||
          (original && !sameRecord(original, current))) {
        throw new MigrationSafetyError(`The target has an unexpected/conflicting ${table} record. Nothing changed; investigate before continuing.`);
      }
    }
    expected.set(table, sourceRows);
    counts.push({ table, source: sourceRows.length, target: targetRows.length });
  }
  if ((expected.get("user")?.length ?? 0) === 0) {
    throw new MigrationSafetyError("The source has no Auth identities. Refusing an empty migration.");
  }
  const [sourceConfig, targetConfig] = await Promise.all([
    getConfig(source),
    getConfig(target),
  ]);
  if (!sourceConfig.endpoint_id || !targetConfig.endpoint_id) {
    throw new MigrationSafetyError("Missing Auth service endpoint configuration.");
  }

  console.table(counts);
  console.log("Auth project configuration will be copied except for target project ID and endpoint ID.");
  console.log("Verification status and the original SoulSeer reader profiles are not changed.");
  if (mode === "--check") {
    console.log("READ-ONLY CHECK COMPLETE. To migrate, rerun with --apply.");
    return;
  }

  // Insert dependent tables in FK order in a single transaction.
  const queries = [target.query(
    "LOCK TABLE " + order.map(tableName).join(", ") + ", neon_auth.project_config IN SHARE ROW EXCLUSIVE MODE"
  )];
  queries.push(target`
    SELECT 1 / CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS endpoint_guard
    FROM neon_auth.project_config
    WHERE id = ${targetConfig.id}::uuid AND endpoint_id = ${targetConfig.endpoint_id}
  `);
  for (const table of order) {
    const records = expected.get(table);
    const stage = "soulseer_auth_" + table;
    queries.push(target.query(
      'CREATE TEMP TABLE "' + stage + '" ON COMMIT DROP AS SELECT * FROM ' + tableName(table) + ' WHERE false'
    ));
    queries.push(target.query(
      'INSERT INTO "' + stage + '" SELECT * FROM jsonb_populate_recordset(NULL::' + tableName(table) + ', $1::jsonb)',
      [JSON.stringify(records)]
    ));
    // Recheck under table locks. A failed assertion rolls back every write.
    queries.push(target.query(
      'DO $$ BEGIN IF EXISTS (SELECT 1 FROM ' + tableName(table) + ' t LEFT JOIN "' + stage + '" s ON s.id=t.id WHERE ' +
      (table === "verification" ? "s.id IS NOT NULL AND " : "") +
      "to_jsonb(t) IS DISTINCT FROM to_jsonb(s)) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Auth migration conflict'; END IF; END $$"
    ));
    if (records.length) queries.push(insertQuery(table, records));
    queries.push(target.query(
      'DO $$ BEGIN IF EXISTS (SELECT 1 FROM "' + stage + '" s LEFT JOIN ' + tableName(table) + ' t ON t.id=s.id WHERE ' +
      "to_jsonb(t) IS DISTINCT FROM to_jsonb(s)) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Auth migration verification failed'; END IF; END $$"
    ));
  }
  // Preserve the new service's ID and endpoint_id. Carry over the actual OAuth,
  // email, trusted-origin and plugin configuration without logging any secrets.
  queries.push(target`
    UPDATE neon_auth.project_config
    SET name = ${sourceConfig.name},
        trusted_origins = ${jsonValue(sourceConfig.trusted_origins)}::jsonb,
        social_providers = ${jsonValue(sourceConfig.social_providers)}::jsonb,
        email_provider = ${jsonValue(sourceConfig.email_provider)}::jsonb,
        email_and_password = ${jsonValue(sourceConfig.email_and_password)}::jsonb,
        allow_localhost = ${sourceConfig.allow_localhost},
        plugin_configs = ${jsonValue(sourceConfig.plugin_configs)}::jsonb,
        webhook_config = ${jsonValue(sourceConfig.webhook_config)}::jsonb
    WHERE id = ${targetConfig.id}::uuid
  `);

  await target.transaction(queries);

  for (const table of order) {
    const actual = await getRows(target, table);
    const original = expected.get(table);
    const byId = new Map(actual.map(row => [row.id, row]));
    if ((table !== "verification" && actual.length !== original.length) ||
        original.some(row => !sameRecord(row, byId.get(row.id)))) {
      throw new MigrationSafetyError(`Verification failed for ${table}. Do not cut over production.`);
    }
  }

  const config = await getConfig(target);
  for (const key of ["name", "trusted_origins", "social_providers",
      "email_provider", "email_and_password", "allow_localhost",
      "plugin_configs", "webhook_config"]) {
    if (!sameRecord(config[key], sourceConfig[key])) {
      throw new MigrationSafetyError(`Config verification failed for ${key}. Do not cut over production.`);
    }
  }
  if (config.endpoint_id !== targetConfig.endpoint_id) {
    throw new MigrationSafetyError("Target Auth endpoint was unexpectedly altered. Do not cut over.");
  }

  const app = await target`
    SELECT count(*)::integer AS profiles,
           count(*) FILTER (WHERE a.id IS NOT NULL)::integer AS linked
    FROM public.users u
    LEFT JOIN neon_auth."user" a ON a.id::text = u.neon_auth_user_id
  `;
  console.log("AUTH DATA COPY VERIFIED. All Auth table records and selected config values match.");
  console.log(`Existing SoulSeer profiles: ${app[0].profiles}; matching Auth identities: ${app[0].linked}.`);
  console.log("NEXT: Confirm managed Auth endpoint, Google OAuth callback, and sign-in on the test branch.");
  console.log("Existing browser sessions may need a fresh login on the new Auth endpoint.");
}

main().catch((error) => {
  // Error messages from database drivers may contain connection-string details.
  // Do not log raw errors, query parameters, or connection strings.
  console.error("Migration stopped or failed. Review database/schema permissions and table constraints.");
  if (error instanceof MigrationSafetyError) console.error(error.message);
  console.error(error?.code ? `Postgres code: ${error.code}` : "No SQL details printed for credential safety.");
  process.exitCode = 1;
});
