import type { MiddlewareHandler } from "hono";
import { AppError } from "./errors";

export const securityHeaders: MiddlewareHandler = async (context, next) => {
  await next();
  context.header("X-Content-Type-Options", "nosniff");
  context.header("X-Frame-Options", "DENY");
  context.header("Referrer-Policy", "strict-origin-when-cross-origin");
  context.header(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=()",
  );
  context.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  context.header(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  context.header(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
};

export const exactOriginCors: MiddlewareHandler<{ Bindings: Env }> = async (
  context,
  next,
) => {
  const origin = context.req.header("Origin");
  const allowedOrigins = new Set([
    context.env.FRONTEND_ORIGIN,
    ...context.env.FRONTEND_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ]);
  if (origin && !allowedOrigins.has(origin)) {
    throw new AppError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "This request origin is not allowed.",
    );
  }
  const responseOrigin = origin ?? context.env.FRONTEND_ORIGIN;

  if (context.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": responseOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, Idempotency-Key, X-SoulSeer-Upload-Capability, X-SoulSeer-Upload-Signature",
        "Access-Control-Allow-Methods":
          "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  await next();
  context.header("Access-Control-Allow-Origin", responseOrigin);
  context.header("Access-Control-Allow-Credentials", "true");
  context.header("Vary", "Origin");
};

export function boundedJson(maxBytes = 64 * 1024): MiddlewareHandler {
  return async (context, next) => {
    if (
      !context.req
        .header("Content-Type")
        ?.toLowerCase()
        .includes("application/json")
    ) {
      await next();
      return;
    }
    const rawLength = context.req.header("Content-Length");
    const length = rawLength ? Number(rawLength) : 0;
    if (!Number.isFinite(length) || length > maxBytes) {
      throw new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The request body is too large.",
      );
    }
    await next();
  };
}

export const rateLimit: MiddlewareHandler<{ Bindings: Env }> = async (
  context,
  next,
) => {
  if (new URL(context.req.url).pathname.startsWith("/api/webhooks/")) {
    await next();
    return;
  }
  const key = context.req.header("CF-Connecting-IP") ?? "unknown";
  const { success } = await context.env.RATE_LIMITER.limit({ key });
  if (!success) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please try again shortly.",
    );
  }
  await next();
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESOURCE_PARENTS = new Set([
  "readers",
  "readings",
  "conversations",
  "messages",
  "users",
  "flags",
  "posts",
  "comments",
  "payouts",
  "refunds",
]);

const EXCLUDED_SLUGS = new Set([
  "online",
  "on-demand",
  "conversations",
  "flagged",
  "financial-summary",
  "balance-adjust",
  "export",
  "me",
  "bootstrap",
  "delete-account",
]);

export const validateUuidParams: MiddlewareHandler = async (context, next) => {
  const pathname = new URL(context.req.url).pathname;
  const segments = pathname.split("/").filter(Boolean);

  for (let i = 1; i < segments.length; i++) {
    const parent = segments[i - 1] ?? "";
    const candidate = segments[i] ?? "";

    if (RESOURCE_PARENTS.has(parent) && !EXCLUDED_SLUGS.has(candidate)) {
      if (!UUID_REGEX.test(candidate)) {
        throw new AppError(400, "INVALID_UUID", "Invalid identifier format.");
      }
    }
  }

  await next();
};
