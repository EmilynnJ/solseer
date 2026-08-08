const accountSecretNames = [
  "NEON_AUTH_ISSUER",
  "NEON_AUTH_JWKS_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "REALTIMEKIT_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_API_TOKEN",
  "CLOUDFLARE_REALTIME_APP_ID",
  "CLOUDFLARE_REALTIME_TOKEN",
  "TELNYX_API_KEY",
  "TELNYX_FROM_NUMBER",
] as const;

type AccountSecretName = (typeof accountSecretNames)[number];
type SecretStoreBinding = { get(): Promise<string> };

export class AccountSecretResolutionError extends Error {
  constructor(readonly bindingName: AccountSecretName) {
    super(`Cloudflare Secrets Store binding ${bindingName} could not be resolved.`);
    this.name = "AccountSecretResolutionError";
  }
}

function isSecretStoreBinding(value: unknown): value is SecretStoreBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as SecretStoreBinding).get === "function"
  );
}

export async function resolveAccountSecrets(env: Env): Promise<Env> {
  const accountBindings = accountSecretNames.flatMap((name) => {
    const binding = env[name] as unknown;
    return isSecretStoreBinding(binding) ? [[name, binding] as const] : [];
  });
  if (accountBindings.length === 0) return env;

  const resolvedEntries = await Promise.all(
    accountBindings.map(async ([name, binding]) => {
      try {
        return [name, await binding.get()] as const;
      } catch {
        throw new AccountSecretResolutionError(name);
      }
    }),
  );

  return { ...env, ...Object.fromEntries(resolvedEntries) };
}
