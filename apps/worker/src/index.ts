import { Hono } from "hono";
import type { AppBindings } from "./types";
import { errorResponse } from "./lib/errors";
import {
  boundedJson,
  exactOriginCors,
  rateLimit,
  securityHeaders,
} from "./lib/http";
import { logger } from "./lib/log";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { forumRoutes } from "./routes/forum";
import { paymentRoutes } from "./routes/payments";
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
  "CLOUDFLARE_REALTIMEKIT_API_TOKEN",
] as const;

type SecretStoreBinding = { get(): Promise<string> };

function isSecretStoreBinding(value: unknown): value is SecretStoreBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as SecretStoreBinding).get === "function"
  );
}

async function resolveAccountSecrets(env: Env): Promise<Env> {
  const accountBindings = accountSecretNames.flatMap((name) => {
    const binding = env[name] as unknown;
    return isSecretStoreBinding(binding) ? [[name, binding] as const] : [];
  });
  if (accountBindings.length === 0) return env;

  const resolvedEntries = await Promise.all(
    accountBindings.map(async ([name, binding]) =>
      [name, await binding.get()] as const,
    ),
  );

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

app.route("/api", publicRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/readers", readerRoutes);
app.route("/api/readings", readingRoutes);
app.route("/api/payments", paymentRoutes);
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
