import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { users, type AuthenticatedUser } from "@soulseer/shared";
import type { AppBindings, AuthIdentity } from "../types";
import { createDatabase } from "./db";
import { AppError } from "./errors";

function bearerToken(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "AUTH_REQUIRED", "Please sign in to continue.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.length > 8192) {
    throw new AppError(
      401,
      "INVALID_SESSION",
      "Your session is invalid or expired.",
    );
  }
  return token;
}

export const NEON_AUTH_ALGORITHMS = ["EdDSA", "RS256", "ES256"];

function requiredEnvUrl(value: string | undefined, name: string): URL {
  try {
    return new URL(String(value));
  } catch {
    throw new AppError(
      500,
      "AUTH_CONFIG_ERROR",
      `Server misconfiguration: ${name} is not set to a valid URL.`,
    );
  }
}

export function neonAuthIssuer(authUrl: string): string {
  return requiredEnvUrl(authUrl, "NEON_AUTH_ISSUER").origin;
}

export async function verifyIdentityToken(
  token: string,
  issuer: string,
  jwks: JWTVerifyGetKey,
): Promise<AuthIdentity> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      algorithms: NEON_AUTH_ALGORITHMS,
    });
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!payload.sub || !email) {
      throw new AppError(
        401,
        "INVALID_SESSION",
        "Your session is missing required identity claims.",
      );
    }
    if (payload.emailVerified !== true) {
      throw new AppError(
        403,
        "EMAIL_NOT_VERIFIED",
        "Verify your email address to continue.",
      );
    }
    return {
      subject: payload.sub,
      email,
      name: typeof payload.name === "string" ? payload.name : null,
      emailVerified: true,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      401,
      "INVALID_SESSION",
      "Your session is invalid or expired.",
    );
  }
}

async function verifyIdentity(token: string, env: Env): Promise<AuthIdentity> {
  return verifyIdentityToken(
    token,
    neonAuthIssuer(env.NEON_AUTH_ISSUER),
    createRemoteJWKSet(requiredEnvUrl(env.NEON_AUTH_JWKS_URL, "NEON_AUTH_JWKS_URL")),
  );
}

export const requireIdentity: MiddlewareHandler<AppBindings> = async (
  context,
  next,
) => {
  const identity = await verifyIdentity(
    bearerToken(context.req.header("Authorization")),
    context.env,
  );
  context.set("identity", identity);
  await next();
};

export const requireUser: MiddlewareHandler<AppBindings> = async (
  context,
  next,
) => {
  const identity = await verifyIdentity(
    bearerToken(context.req.header("Authorization")),
    context.env,
  );
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.neonAuthUserId, identity.subject))
    .limit(1);

  if (!profile) {
    throw new AppError(
      409,
      "PROFILE_REQUIRED",
      "Complete your SoulSeer profile to continue.",
    );
  }
  if (profile.status !== "active") {
    throw new AppError(
      403,
      "ACCOUNT_UNAVAILABLE",
      "This account is not currently active.",
    );
  }

  const user: AuthenticatedUser = {
    id: profile.id,
    neonAuthUserId: profile.neonAuthUserId,
    email: profile.email,
    username: profile.username,
    fullName: profile.fullName,
    role: profile.role,
    status: profile.status,
  };

  context.set("identity", identity);
  context.set("user", user);
  await next();
};

export function requireRole(
  ...roles: AuthenticatedUser["role"][]
): MiddlewareHandler<AppBindings> {
  return async (context, next) => {
    const user = context.get("user");
    if (!roles.includes(user.role)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to perform this action.",
      );
    }
    await next();
  };
}
