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
  const response = await fetch(`${authUrl}/token`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Neon Auth token request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { token?: unknown } | null;
  return typeof payload?.token === "string" && payload.token.length > 0
    ? payload.token
    : null;
}
