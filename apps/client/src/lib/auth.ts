import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

export const authClient = createAuthClient(
  authUrl || "http://localhost:4000/auth",
  {
    adapter: BetterAuthReactAdapter(),
  },
);

export async function getAccessToken(): Promise<string | null> {
  const response = await authClient.getSession();
  return response.data?.session?.token ?? null;
}
