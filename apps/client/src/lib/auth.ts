import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const authUrl = (
  import.meta.env.VITE_NEON_AUTH_URL || "http://localhost:4000/auth"
).replace(/\/$/, "");

export const authClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter({
    // Neon Auth is hosted on a different origin from the SoulSeer frontend.
    fetchOptions: { credentials: "include" },
  }),
});

function isSignedJwt(value: unknown): value is string {
  // Better Auth's opaque session identifier must never be sent to the Worker.
  return typeof value === "string" &&
    value.split(".").length === 3 &&
    value.split(".").every((part) => part.length > 0);
}

export async function getAccessToken(): Promise<string | null> {
  // Neon JS automatically injects the JWT from the set-auth-jwt response
  // header into getSession().data.session.token. That property is therefore
  // a signed JWT when provided by this SDK, even though bare Better Auth
  // would otherwise expose an opaque session token.
  const session = await authClient.getSession();
  if (session.error) {
    throw new Error(session.error.message || "Could not check your session.");
  }
  const sessionToken = session.data?.session?.token;
  if (isSignedJwt(sessionToken)) return sessionToken;

  if (!session.data?.user) return null;

  // Fall back to the Better Auth JWT plugin when the session response did
  // not include a signed token (for example, a cached/session-only response).
  const { data, error } = await authClient.token();
  if (error) {
    throw new Error(error.message || "Could not refresh your access token.");
  }
  if (isSignedJwt(data?.token)) return data.token;

  // A valid login without a JWT must never silently call /api/auth/me
  // without an Authorization header: that causes an AUTH_REQUIRED loop.
  throw new Error(
    "Your Neon login succeeded, but the API access token is missing. " +
      "Please sign out and sign in again. If this continues, check browser third-party cookie settings.",
  );
}
