import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const authUrl = (
  import.meta.env.VITE_NEON_AUTH_URL || "http://localhost:4000/auth"
).replace(/\/$/, "");

export const authClient = createAuthClient(
  authUrl,
  {
    adapter: BetterAuthReactAdapter(),
  },
);

export async function getAccessToken(): Promise<string | null> {
  // neon-js re-exports the runtime method but its React adapter return type
  // currently omits it. Keep token retrieval inside the SDK so session caching,
  // refreshes, and credential handling all follow Neon's supported path.
  return (
    authClient as typeof authClient & {
      getJWTToken(): Promise<string | null>;
    }
  ).getJWTToken();
}
