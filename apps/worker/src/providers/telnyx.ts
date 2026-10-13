import { z } from "zod";

const telnyxResponseSchema = z.object({
  data: z.object({ id: z.string().min(1) }),
});

const telnyxErrorSchema = z.object({
  errors: z
    .array(z.object({ code: z.union([z.string(), z.number()]).optional() }))
    .optional(),
});

export class SmsProviderError extends Error {
  constructor(
    readonly providerStatus: number,
    readonly providerCodes: string[],
  ) {
    super("SMS provider request failed.");
    this.name = "SmsProviderError";
  }
}

export function smsIsConfigured(
  env: Env,
): env is Env & { TELNYX_API_KEY: string; TELNYX_FROM_NUMBER: string } {
  return Boolean(env.TELNYX_API_KEY && env.TELNYX_FROM_NUMBER);
}

export async function sendSms(
  env: Env & { TELNYX_API_KEY: string; TELNYX_FROM_NUMBER: string },
  input: { to: string; text: string },
): Promise<string> {
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.TELNYX_FROM_NUMBER,
      to: input.to,
      text: input.text,
      type: "SMS",
      auto_detect: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const payload = telnyxErrorSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new SmsProviderError(
      response.status,
      payload.success
        ? (payload.data.errors ?? []).flatMap((error) =>
            error.code === undefined ? [] : [String(error.code)],
          )
        : [],
    );
  }
  const result = telnyxResponseSchema.safeParse(await response.json());
  if (!result.success) {
    throw new SmsProviderError(response.status, ["invalid_response"]);
  }
  return result.data.data.id;
}
