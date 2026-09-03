import { logger } from "./log";

const accountSecretNames = [
  "NEON_AUTH_ISSUER",
  "NEON_AUTH_JWKS_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "REALTIMEKIT_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_API_TOKEN",
  "TELNYX_API_KEY",
  "TELNYX_FROM_NUMBER",
] as const;

type SecretStoreBinding = { get(): Promise<string> };

export async function resolveAccountSecrets(env: Env): Promise<Env> {
  const resolvedEntries: [string, string][] = [];
  // RPC bindings can report arbitrary method names as present. In particular,
  // testing for `put`/`idFromName` incorrectly excludes Secrets Store bindings.
  // Only inspect declared secret names, never unrelated R2/DO/service bindings.
  for (const name of accountSecretNames) {
    const binding = env[name as keyof Env] as unknown;
    if (
      typeof binding !== "object" || binding === null ||
      typeof (binding as SecretStoreBinding).get !== "function"
    ) continue;

    try {
      const secret = await (binding as SecretStoreBinding).get();
      if (typeof secret === "string" && secret.trim()) {
        resolvedEntries.push([name, secret]);
      } else {
        logger.warn("Secrets Store binding returned an empty value", { operation: name });
      }
    } catch {
      // Never log secret values or provider exception text, which may contain
      // credentials. Preserve the binding so downstream validation fails closed.
      logger.warn("Secrets Store binding failed to resolve", { operation: name });
    }
  }
  return { ...env, ...Object.fromEntries(resolvedEntries) };
}
