import { z } from "zod";
import { AppError } from "../lib/errors";

export type RealtimeKitStage =
  | "presets"
  | "meeting"
  | "participant"
  | "participant_token"
  | "end_session"
  | "disable_meeting";

export class RealtimeKitProviderError extends Error {
  constructor(
    readonly stage: RealtimeKitStage,
    readonly providerStatus: number,
    readonly providerCodes: string[],
  ) {
    super(`RealtimeKit ${stage} request failed.`);
    this.name = "RealtimeKitProviderError";
  }
}

const meetingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ id: z.string().min(1) }),
});

const participantResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().min(1),
    token: z.string().min(1).optional(),
    auth_token: z.string().min(1).optional(),
  }),
});

const refreshedTokenResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ token: z.string().min(1) }),
});

const presetListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      name: z.string().min(1),
    }),
  ),
});

const providerErrorResponseSchema = z.object({
  errors: z
    .array(
      z.object({
        code: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),
});

type RealtimeKitConfig = Pick<
  Env,
  | "CLOUDFLARE_ACCOUNT_ID"
  | "REALTIMEKIT_APP_ID"
  | "CLOUDFLARE_REALTIMEKIT_API_TOKEN"
>;

function runtimeString(
  env: RealtimeKitConfig,
  ...names: string[]
): string | undefined {
  const bindings = env as unknown as Record<string, unknown>;
  for (const name of names) {
    const value = bindings[name];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function requiredConfig(
  value: string | undefined,
  code: string,
  stage: RealtimeKitStage,
): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new RealtimeKitProviderError(stage, 0, [code]);
  }
  return normalized;
}

function apiToken(env: RealtimeKitConfig, stage: RealtimeKitStage): string {
  const token = requiredConfig(
    runtimeString(
      env,
      "CLOUDFLARE_REALTIMEKIT_API_TOKEN",
      "REALTIMEKIT_API_TOKEN",
      "CLOUDFLARE_REALTIME_TOKEN",
      "REALTIME_TOKEN",
      "CLOUDFLARE_REALTIME_API_TOKEN",
      "REALTIME_API_TOKEN",
      "REALTIMEKIT_TOKEN",
    ),
    "missing_api_token",
    stage,
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    throw new RealtimeKitProviderError(stage, 0, ["missing_api_token"]);
  }
  return token;
}

function apiBase(env: RealtimeKitConfig, stage: RealtimeKitStage): string {
  const accountId = requiredConfig(
    env.CLOUDFLARE_ACCOUNT_ID,
    "missing_account_id",
    stage,
  );
  const appId = requiredConfig(
    runtimeString(
      env,
      "CLOUDFLARE_REALTIME_APP_ID",
      "REALTIMEKIT_APP_ID",
      "REALTIMEKIT_API_APP_ID",
      "CLOUDFLARE_REALTIMEKIT_APP_ID",
      "REALTIMEKIT_APP_ID_API",
      "REALTIMEKIT_APP_API_ID",
      "REALTIME_APP_ID",
    ),
    "missing_app_id",
    stage,
  );
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/realtime/kit/${encodeURIComponent(appId)}`;
}

async function request<T>(
  env: RealtimeKitConfig,
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  stage: RealtimeKitStage,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiToken(env, stage)}`);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBase(env, stage)}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const payload = providerErrorResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new RealtimeKitProviderError(
      stage,
      response.status,
      payload.success
        ? (payload.data.errors ?? []).flatMap((error) =>
            error.code === undefined ? [] : [String(error.code)],
          )
        : [],
    );
  }
  try {
    return schema.parse(await response.json());
  } catch {
    throw new RealtimeKitProviderError(stage, response.status, [
      "invalid_response",
    ]);
  }
}

function normalizedPresetName(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function findPreset(
  names: string[],
  preferred: string,
  role: "host" | "participant",
): string | undefined {
  const exact = names.find(
    (name) => normalizedPresetName(name) === normalizedPresetName(preferred),
  );
  if (exact) return exact;
  return (
    names.find((name) => {
      const normalized = normalizedPresetName(name);
      return normalized.includes(role) && normalized.includes("group");
    }) ?? names.find((name) => normalizedPresetName(name).includes(role))
  );
}

export function selectParticipantPresets(names: string[]): {
  client: string;
  reader: string;
} {
  const reader = findPreset(names, "soulseer-reader", "host") ?? names[0];
  const client =
    findPreset(names, "soulseer-client", "participant") ?? names[0];
  if (!reader || !client) {
    throw new RealtimeKitProviderError("presets", 200, [
      "no_presets_configured",
    ]);
  }
  return { client, reader };
}

export async function resolveParticipantPresets(
  env: RealtimeKitConfig,
): Promise<{ client: string; reader: string }> {
  const result = await request(
    env,
    "/presets",
    { method: "GET" },
    presetListResponseSchema,
    "presets",
  );
  return selectParticipantPresets(result.data.map((preset) => preset.name));
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
      }),
    },
    meetingResponseSchema,
    "meeting",
  );
  return result.data.id;
}

export async function addParticipant(
  env: RealtimeKitConfig,
  input: {
    meetingId: string;
    appUserId: string;
    displayName: string;
    presetName: string;
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
    "participant",
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
    "participant_token",
  );
  return result.data.token;
}

export async function endSession(
  env: RealtimeKitConfig,
  meetingId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBase(env, "end_session")}/meetings/${meetingId}/active-session/kick-all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken(env, "end_session")}`,
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
  const response = await fetch(
    `${apiBase(env, "disable_meeting")}/meetings/${meetingId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiToken(env, "disable_meeting")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "INACTIVE" }),
      signal: AbortSignal.timeout(10_000),
    },
  );
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

