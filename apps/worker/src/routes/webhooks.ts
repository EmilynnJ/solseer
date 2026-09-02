import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  providerEvents,
  readerProfiles,
  readingEvents,
  readingSessions,
  realtimeKitEventSchema,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";
import { logger } from "../lib/log";
import { verifyRealtimeKitSignature } from "../providers/realtimekit";
import { constructStripeEvent, createStripe } from "../providers/stripe";
import type { ReadingCoordinator } from "../durable/reading-coordinator";

export const webhookRoutes = new Hono<AppBindings>();

webhookRoutes.post("/stripe", async (context) => {
  const signature = context.req.header("Stripe-Signature");
  if (!signature)
    throw new AppError(400, "MISSING_SIGNATURE", "Missing Stripe signature.");
  const rawBody = await context.req.text();
  const stripe = createStripe(context.env);
  let event;
  try {
    event = await constructStripeEvent(
      stripe,
      rawBody,
      signature,
      context.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(401, "INVALID_SIGNATURE", "Invalid Stripe signature.");
  }

  const { db, sql } = createDatabase(context.env.DATABASE_URL);
  const [seen] = await db
    .select({ id: providerEvents.id })
    .from(providerEvents)
    .where(
      and(
        eq(providerEvents.provider, "stripe"),
        eq(providerEvents.eventId, event.id),
      ),
    )
    .limit(1);
  if (seen) return context.json({ received: true, duplicate: true });

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const userId = intent.metadata.soulseerUserId;
    const expectedAmount = Number(intent.metadata.amountCents);
    if (
      intent.metadata.purpose !== "wallet_top_up" ||
      !userId ||
      !Number.isSafeInteger(expectedAmount) ||
      expectedAmount !== intent.amount_received ||
      intent.currency !== "usd"
    ) {
      throw new AppError(
        400,
        "INVALID_PAYMENT_METADATA",
        "Stripe payment metadata is invalid.",
      );
    }
    await sql`
      SELECT public.credit_wallet_payment(
        ${userId}::uuid,
        ${intent.amount_received}::integer,
        ${intent.id},
        ${`stripe:${event.id}`}
      )
    `;
  } else if (event.type === "account.updated") {
    const account = event.data.object;
    const readerId = account.metadata?.soulseerReaderId;
    const onboardingComplete =
      account.details_submitted && account.capabilities?.transfers === "active";
    if (readerId) {
      await db
        .update(readerProfiles)
        .set({
          stripeOnboardingComplete: onboardingComplete,
          updatedAt: new Date(),
        })
        .where(eq(readerProfiles.userId, readerId));
    } else {
      await db
        .update(readerProfiles)
        .set({
          stripeOnboardingComplete: onboardingComplete,
          updatedAt: new Date(),
        })
        .where(eq(readerProfiles.stripeAccountId, account.id));
    }
  } else if (event.type === "transfer.created") {
    const transfer = event.data.object;
    const payoutId = transfer.metadata.payoutRecordId;
    if (payoutId) {
      await sql`
        SELECT public.complete_reader_payout(${payoutId}::uuid, ${transfer.id})
      `;
    }
  } else if (event.type === "transfer.reversed") {
    const transfer = event.data.object;
    const payoutId = transfer.metadata.payoutRecordId;
    if (payoutId) {
      await sql`
        SELECT public.fail_reader_payout(${payoutId}::uuid, ${"Stripe transfer reversed"})
      `;
    }
  }

  await db
    .insert(providerEvents)
    .values({
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    })
    .onConflictDoNothing();
  logger.info("Stripe webhook processed", {
    requestId: context.get("requestId"),
    providerEventId: event.id,
    operation: event.type,
  });
  return context.json({ received: true });
});

webhookRoutes.post("/realtimekit", async (context) => {
  const signature = context.req.header("rtk-signature");
  const deliveryId = context.req.header("rtk-uuid");
  if (!signature || !deliveryId) {
    throw new AppError(
      400,
      "MISSING_SIGNATURE",
      "Missing RealtimeKit webhook identity.",
    );
  }
  const rawBody = await context.req.arrayBuffer();
  if (
    !(await verifyRealtimeKitSignature(
      rawBody,
      signature,
      context.env.REALTIMEKIT_WEBHOOK_PUBLIC_KEY_URL,
    ))
  ) {
    throw new AppError(
      401,
      "INVALID_SIGNATURE",
      "Invalid RealtimeKit signature.",
    );
  }
  const payload = realtimeKitEventSchema.parse(
    JSON.parse(new TextDecoder().decode(rawBody)),
  );
  const meetingId = payload.meeting?.id ?? payload.meetingId;
  if (!meetingId)
    throw new AppError(
      400,
      "MISSING_MEETING",
      "RealtimeKit event has no meeting id.",
    );

  const { db } = createDatabase(context.env.DATABASE_URL);
  const [reading] = await db
    .select()
    .from(readingSessions)
    .where(eq(readingSessions.cloudflareMeetingId, meetingId))
    .limit(1);
  if (!reading)
    throw new AppError(
      404,
      "READING_NOT_FOUND",
      "Reading for this meeting was not found.",
    );

  await db
    .insert(readingEvents)
    .values({
      readingId: reading.id,
      providerEventKey: `realtimekit:${deliveryId}`,
      eventType: payload.event,
      occurredAt: eventTime(payload),
      payload: JSON.parse(new TextDecoder().decode(rawBody)) as Record<
        string,
        unknown
      >,
    })
    .onConflictDoNothing();

  if (payload.meeting?.sessionId && !reading.cloudflareSessionId) {
    await db
      .update(readingSessions)
      .set({
        cloudflareSessionId: payload.meeting.sessionId,
        updatedAt: new Date(),
      })
      .where(eq(readingSessions.id, reading.id));
  }

  const coordinator = context.env.READING_COORDINATOR.getByName(
    reading.id,
  ) as DurableObjectStub<ReadingCoordinator>;
  if (payload.event === "meeting.participantJoined") {
    await coordinator.providerEvent({
      type: "participant_joined",
      appUserId: payload.participant?.customParticipantId,
      occurredAt: payload.participant?.joinedAt ?? new Date().toISOString(),
      sessionId: payload.meeting?.sessionId,
    });
  } else if (payload.event === "meeting.participantLeft") {
    await coordinator.providerEvent({
      type: "participant_left",
      appUserId: payload.participant?.customParticipantId,
      occurredAt: payload.participant?.leftAt ?? new Date().toISOString(),
      sessionId: payload.meeting?.sessionId,
    });
  } else if (payload.event === "meeting.ended") {
    await coordinator.providerEvent({
      type: "meeting_ended",
      occurredAt: payload.meeting?.endedAt ?? new Date().toISOString(),
      sessionId: payload.meeting?.sessionId,
    });
  } else if (
    payload.event === "meeting.chatSynced" &&
    payload.chatDownloadUrl
  ) {
    const transcript = await downloadLimitedJson(
      payload.chatDownloadUrl,
      2 * 1024 * 1024,
    );
    await db
      .update(readingSessions)
      .set({
        chatTranscript: Array.isArray(transcript) ? transcript : [transcript],
        updatedAt: new Date(),
      })
      .where(eq(readingSessions.id, reading.id));
  }

  logger.info("RealtimeKit webhook processed", {
    requestId: context.get("requestId"),
    readingId: reading.id,
    providerEventId: deliveryId,
    operation: payload.event,
  });
  return context.json({ received: true });
});

function eventTime(payload: {
  meeting?:
    | { startedAt?: string | undefined; endedAt?: string | undefined }
    | undefined;
  participant?:
    | { joinedAt?: string | undefined; leftAt?: string | undefined }
    | undefined;
}): Date {
  const value =
    payload.participant?.joinedAt ??
    payload.participant?.leftAt ??
    payload.meeting?.startedAt ??
    payload.meeting?.endedAt;
  return value ? new Date(value) : new Date();
}

export async function downloadLimitedJson(
  url: string,
  maxBytes: number,
): Promise<unknown> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Chat download URL must use HTTPS.");
  }
  const allowedDomains = [
    "cloudflare.com",
    "realtimekit.com",
    "cloudflarestream.com",
  ];
  const isAllowed = allowedDomains.some(
    (domain) =>
      parsedUrl.hostname === domain ||
      parsedUrl.hostname.endsWith(`.${domain}`),
  );
  if (!isAllowed) {
    throw new Error("Chat download URL domain is not allowed.");
  }

  // Security: Disallow HTTP redirects (`redirect: "error"`) to prevent SSRF bypasses via open redirectors on allowed domains.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (!response.ok || !response.body)
    throw new Error("Chat replay download failed.");
  const statedLength = Number(response.headers.get("Content-Length") ?? 0);
  if (statedLength > maxBytes)
    throw new Error("Chat replay exceeds the retention limit.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel("size limit exceeded");
      throw new Error("Chat replay exceeds the retention limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
