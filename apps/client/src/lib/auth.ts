import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const authUrl = (
  import.meta.env.VITE_NEON_AUTH_URL || "http://localhost:4000/auth"
).replace(/\/$/, "");

export const authClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter({
    // The Neon Auth service uses a different origin from the SoulSeer frontend.
    fetchOptions: { credentials: "include" },
  }),
});

export async function getAccessToken(): Promise<string | null> {
  // Neon SDK session caching may intercept authClient.token() and return a
  // getSession-shaped response without a JWT. Request the JWT endpoint
  // directly so the Worker receives an actual, freshly signed bearer token.
  // The HttpOnly session cookie is sent automatically; never read or store it.
  const response = await fetch(`${authUrl}/token`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Could not refresh your sign-in session.");

  const payload = (await response.json().catch(() => null)) as
    | { token?: unknown }
    | null;
  const token = payload?.token;
  // Reject missing/malformed tokens; the Cloudflare Worker verifies JWT
  // signatures, expiry and account identity on every protected request.
  return typeof token === "string" && token.split(".").length === 3
    ? token
    : null;
}
