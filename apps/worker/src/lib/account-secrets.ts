import { logger } from "./log";

const accountSecretNames = [
  "NEON_AUTH_ISSUER",
  "NEON_AUTH_JWKS_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "REALTIMEKIT_APP_ID",
  "CLOUDFLARE_REALTIME_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_APP_ID",
  "REALTIMEKIT_API_APP_ID",
  "REALTIMEKIT_APP_ID_API",
  "REALTIMEKIT_APP_API_ID",
  "REALTIME_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_API_TOKEN",
  "REALTIMEKIT_API_TOKEN",
  "CLOUDFLARE_REALTIME_TOKEN",
  "REALTIME_TOKEN",
  "CLOUDFLARE_REALTIME_API_TOKEN",
  "REALTIME_API_TOKEN",
  "REALTIMEKIT_TOKEN",
  "TELNYX_API_KEY",
  "TELNYX_FROM_NUMBER",
] as const;

type SecretStoreBinding = { get(): Promise<string> };

export async function resolveAccountSecrets(env: Env): Promise<Env> {
  const resolvedBindings: Record<string, string | undefined> = {};
  // RPC bindings can report arbitrary method names as present. In particular,
  // testing for `put`/`idFromName` incorrectly excludes Secrets Store bindings.
  // Only inspect declared secret names, never unrelated R2/DO/service bindings.
  for (const name of accountSecretNames) {
    const binding = env[name as keyof Env] as unknown;
    if (
      typeof binding !== "object" || binding === null ||
      typeof (binding as SecretStoreBinding).get !== "function"
    ) continue;

    // A failed binding must not remain a truthy object in provider config.
    resolvedBindings[name] = undefined;
    try {
      const secret = await (binding as SecretStoreBinding).get();
      if (typeof secret === "string" && secret.trim()) {
        resolvedBindings[name] = secret;
      } else {
        logger.warn("Secrets Store binding returned an empty value", { operation: name });
      }
    } catch {
      // Never log secret values or provider exception text, which may contain
      // credentials. Leave the failed credential unavailable to consumers.
      logger.warn("Secrets Store binding failed to resolve", { operation: name });
    }
  }
  return { ...env, ...resolvedBindings };
}
