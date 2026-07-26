import { z } from "zod";
import { AppError } from "../lib/errors";

const meetingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ id: z.string().uuid() }),
});

const participantResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    token: z.string().min(1).optional(),
    auth_token: z.string().min(1).optional(),
  }),
});

const refreshedTokenResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ token: z.string().min(1) }),
});

type RealtimeKitConfig = Pick<
  Env,
  | "CLOUDFLARE_ACCOUNT_ID"
  | "REALTIMEKIT_APP_ID"
  | "CLOUDFLARE_REALTIMEKIT_API_TOKEN"
>;

function apiBase(env: RealtimeKitConfig): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/realtime/kit/${env.REALTIMEKIT_APP_ID}`;
}

async function request<T>(
  env: RealtimeKitConfig,
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_REALTIMEKIT_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new AppError(
      502,
      "REALTIMEKIT_ERROR",
      "The reading service is temporarily unavailable.",
    );
  }
  return schema.parse(await response.json());
}

export async function createMeeting(
  env: RealtimeKitConfig,
  readingId: string,
): Promise<string> {
  const result = await request(
    env,
    "/meetings",
    {
      method: "POST",
      body: JSON.stringify({
        title: `SoulSeer reading ${readingId}`,
        persist_chat: true,
        status: "ACTIVE",
        session_keep_alive_time_in_secs: 120,
      }),
    },
    meetingResponseSchema,
  );
  return result.data.id;
}

export async function addParticipant(
  env: RealtimeKitConfig,
  input: {
    meetingId: string;
    appUserId: string;
    displayName: string;
    presetName: "soulseer-client" | "soulseer-reader";
  },
): Promise<{ id: string; token: string }> {
  const result = await request(
    env,
    `/meetings/${input.meetingId}/participants`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.displayName,
        preset_name: input.presetName,
        custom_participant_id: input.appUserId,
      }),
    },
    participantResponseSchema,
  );
  const token = result.data.token ?? result.data.auth_token;
  if (!token) {
    throw new AppError(
      502,
      "REALTIMEKIT_TOKEN_MISSING",
      "The reading participant token was not returned.",
    );
  }
  return { id: result.data.id, token };
}

export async function refreshParticipantToken(
  env: RealtimeKitConfig,
  meetingId: string,
  participantId: string,
): Promise<string> {
  const result = await request(
    env,
    `/meetings/${meetingId}/participants/${participantId}/token`,
    { method: "POST", body: "{}" },
    refreshedTokenResponseSchema,
  );
  return result.data.token;
}

export async function endSession(
  env: RealtimeKitConfig,
  meetingId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBase(env)}/meetings/${meetingId}/active-session/kick-all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_REALTIMEKIT_API_TOKEN}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new AppError(
      502,
      "REALTIMEKIT_END_FAILED",
      "The reading could not be ended cleanly.",
    );
  }
}

export async function disableMeeting(
  env: RealtimeKitConfig,
  meetingId: string,
): Promise<void> {
  const response = await fetch(`${apiBase(env)}/meetings/${meetingId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_REALTIMEKIT_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "INACTIVE" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new AppError(
      502,
      "REALTIMEKIT_DISABLE_FAILED",
      "The completed reading room could not be disabled.",
    );
  }
}

export async function verifyRealtimeKitSignature(
  rawBody: ArrayBuffer,
  signature: string,
  publicKeyUrl: string,
): Promise<boolean> {
  const response = await fetch(publicKeyUrl, {
    signal: AbortSignal.timeout(5_000),
  });
  const responseSchema = z.object({
    success: z.literal(true),
    data: z.object({ publicKey: z.string().min(1) }),
  });
  const publicKeyResponse = responseSchema.parse(await response.json());
  const pem = publicKeyResponse.data.publicKey
    .replaceAll("\\n", "")
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "spki",
    Uint8Array.from(atob(pem), (character) => character.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    Uint8Array.from(atob(signature), (character) => character.charCodeAt(0)),
    rawBody,
  );
}
