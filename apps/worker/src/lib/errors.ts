import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
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

export function errorResponse(error: unknown, context: Context): Response {
  const requestId = context.get("requestId") as string;
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError(
            400,
            "VALIDATION_ERROR",
            "The request contains invalid fields.",
            error.flatten(),
          )
        : new AppError(
            500,
            "INTERNAL_ERROR",
            "The request could not be completed.",
          );

  logger.error(
    appError.message,
    { requestId, route: new URL(context.req.url).pathname },
    {
      code: appError.code,
      error: error instanceof Error ? error.message : String(error),
    },
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
