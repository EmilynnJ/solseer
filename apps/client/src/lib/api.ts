import type { ApiErrorShape } from "@soulseer/shared";
import { getAccessToken } from "./auth";

const API_ORIGIN = (
  import.meta.env.VITE_API_ORIGIN || "http://localhost:8787"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function isProfileRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "PROFILE_REQUIRED" || error.status === 404)
  );
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body)
    headers.set("Content-Type", "application/json");
  if (authenticated) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiErrorShape | null;
    throw new ApiError(
      payload?.error.message ?? "Something went wrong. Please try again.",
      response.status,
      payload?.error.code ?? "REQUEST_FAILED",
      payload?.error.details,
    );
  }
  return (await response.json()) as T;
}

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export const duration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

export { API_ORIGIN };
