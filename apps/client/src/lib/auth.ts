import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const authUrl = (
  import.meta.env.VITE_NEON_AUTH_URL || "http://localhost:4000/auth"
).replace(/\/$/, "");

export const authClient = createAuthClient(authUrl, {
  // Neon Auth is on a different origin. Send the session cookie for JWT requests.
  // fetchOptions belong to the client, NOT to the React adapter.
  fetchOptions: { credentials: "include" },
  adapter: BetterAuthReactAdapter(),
});

export async function getAccessToken(): Promise<string | null> {
  // getSession().data.session.token is an opaque session identifier, NOT a JWT.
  // The Cloudflare Worker verifies signed JWTs using Neon Auth's JWKS endpoint.
  const { data, error } = await authClient.token();
  if (error) throw new Error(error.message || "Could not refresh your session.");
  return data?.token ?? null;
}
