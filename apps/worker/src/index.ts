import { Hono } from "hono";
import type { AppBindings } from "./types";
import { errorResponse } from "./lib/errors";
import { resolveAccountSecrets } from "./lib/account-secrets";
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
import { messageRoutes } from "./routes/messages";
import { publicRoutes } from "./routes/public";
import { readerRoutes } from "./routes/readers";
import { readingRoutes } from "./routes/readings";
import { uploadRoutes } from "./routes/uploads";
import { transactionRoutes, userRoutes } from "./routes/user";
import { webhookRoutes } from "./routes/webhooks";

export { ReadingCoordinator } from "./durable/reading-coordinator";

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
