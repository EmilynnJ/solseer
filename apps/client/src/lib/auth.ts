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
  const token = await authClient.token();
  return token.data?.token ?? null;
}
