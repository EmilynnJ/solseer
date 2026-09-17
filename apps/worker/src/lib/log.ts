export type LogContext = {
  requestId?: string;
  userId?: string;
  readingId?: string;
  providerEventId?: string;
  route?: string;
  operation?: string;
};

function write(
  level: "info" | "warn" | "error",
  message: string,
  context: LogContext = {},
  details?: Record<string, unknown>,
): void {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...details,
  });

  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export const logger = {
  info: (
    message: string,
    context?: LogContext,
    details?: Record<string, unknown>,
  ) => { write("info", message, context, details); },
  warn: (
    message: string,
    context?: LogContext,
    details?: Record<string, unknown>,
  ) => { write("warn", message, context, details); },
  error: (
    message: string,
    context?: LogContext,
    details?: Record<string, unknown>,
  ) => { write("error", message, context, details); },
};
