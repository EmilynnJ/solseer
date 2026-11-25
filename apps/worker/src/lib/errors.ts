import type { Context } from "hono";
import type { AppBindings } from "../types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z, ZodError } from "zod";
import { logger } from "./log";

export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown, context: Context<AppBindings>): Response {
  const requestId = context.get("requestId") as string;
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError(
            400,
            "VALIDATION_ERROR",
            "The request contains invalid fields.",
            z.treeifyError(error),
          )
        : new AppError(
            500,
            "INTERNAL_ERROR",
            "The request could not be completed.",
          );

  logger.error(
    "Request failed",
    { requestId, route: context.req.routePath, userId: context.get("user")?.id, authUserId: context.get("identity")?.subject },
    { code: appError.code, status: appError.status, method: context.req.method },
  );

  return context.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        requestId,
        ...(appError.details === undefined
          ? {}
          : { details: appError.details }),
      },
    },
    appError.status,
  );
}
