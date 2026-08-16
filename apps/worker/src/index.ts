import { Hono } from "hono";
import type { AppBindings } from "./types";
import { errorResponse } from "./lib/errors";
import {
  boundedJson,
  exactOriginCors,
  rateLimit,
  securityHeaders,
  validateUuidParams,
} from "./lib/http";
import { logger } from "./lib/log";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { forumRoutes } from "./routes/forum";
import { paymentRoutes } from "./routes/payments";
import { messageRoutes } from "./routes/messages";
import { publicRoutes } from "./routes/public";
import { readerRoutes } from "./routes/readers";
import { readingRoutes } from "./routes/readings";
import { uploadRoutes } from "./routes/uploads";
import { transactionRoutes, userRoutes } from "./routes/user";
import { webhookRoutes } from "./routes/webhooks";

export { ReadingCoordinator } from "./durable/reading-coordinator";

const accountSecretNames = [
  "NEON_AUTH_ISSUER",
  "NEON_AUTH_JWKS_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "REALTIMEKIT_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_APP_ID",
  "CLOUDFLARE_REALTIMEKIT_API_TOKEN",
  "TELNYX_API_KEY",
  "TELNYX_FROM_NUMBER",
] as const;

type SecretStoreBinding = { get(): Promise<string> };

function isSecretStoreBinding(value: unknown): value is SecretStoreBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as SecretStoreBinding).get === "function" &&
    !("idFromName" in value) && // Exclude DurableObjectNamespace
    !("put" in value) // Exclude R2Bucket
  );
}

async function resolveAccountSecrets(env: Env): Promise<Env> {
  const keys = new Set<string>([
    ...accountSecretNames,
    ...Object.keys(env || {}),
  ]);

  const accountBindings: [string, SecretStoreBinding][] = [];
  for (const key of keys) {
    const binding = env[key as keyof Env] as unknown;
    if (isSecretStoreBinding(binding)) {
      accountBindings.push([key, binding]);
    }
  }

  if (accountBindings.length === 0) return env;

  const resolvedEntries: [string, string][] = [];
  for (const [name, binding] of accountBindings) {
    try {
      const secret = await binding.get();
      if (typeof secret === "string") {
        resolvedEntries.push([name, secret]);
      }
    } catch {
      // Gracefully ignore bindings that are not SecretsStoreSecret (e.g. DurableObjectNamespace, ColoLocalActorNamespace)
    }
  }

  return {
    ...env,
    ...Object.fromEntries(resolvedEntries),
  } as Env;
}

const app = new Hono<AppBindings>();

app.use("*", async (context, next) => {
  const requestId = context.req.header("CF-Ray") ?? crypto.randomUUID();
  context.set("requestId", requestId);
  const startedAt = Date.now();
  await next();
  context.header("X-Request-Id", requestId);
  logger.info(
    "Request completed",
    { requestId, route: new URL(context.req.url).pathname },
    {
      method: context.req.method,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    },
  );
});
app.use("*", securityHeaders);
app.use("/api/*", exactOriginCors);
app.use("/api/*", boundedJson());
app.use("/api/*", rateLimit);
app.use("/api/*", validateUuidParams);

app.route("/api", publicRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/readers", readerRoutes);
app.route("/api/readings", readingRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/forum", forumRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/uploads", uploadRoutes);
app.route("/api/user", userRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/webhooks", webhookRoutes);

app.notFound((context) =>
  context.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
        requestId: context.get("requestId"),
      },
    },
    404,
  ),
);
app.onError((error, context) => errorResponse(error, context));

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    return app.fetch(
      request,
      await resolveAccountSecrets(env),
      executionContext,
    );
  },
};
