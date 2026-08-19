import { and, eq } from "drizzle-orm";
import {
  notificationDeliveries,
  readerProfiles,
  type ReadingSession,
} from "@soulseer/shared";
import { createDatabase } from "../lib/db";
import { logger } from "../lib/log";
import {
  sendSms,
  smsIsConfigured,
  SmsProviderError,
} from "../providers/telnyx";

export async function notifyReaderOfIncomingReading(
  env: Env,
  reading: Pick<ReadingSession, "id" | "readerId" | "type">,
): Promise<void> {
  const { db } = createDatabase(env.DATABASE_URL);
  const [settings] = await db
    .select({
      phoneNumber: readerProfiles.phoneNumber,
      enabled: readerProfiles.smsNotificationsEnabled,
    })
    .from(readerProfiles)
    .where(eq(readerProfiles.userId, reading.readerId))
    .limit(1);
  if (!settings?.enabled || !settings.phoneNumber) return;
  if (!smsIsConfigured(env)) {
    logger.warn(
      "Reader SMS notification skipped because SMS is not configured",
      {
        readingId: reading.id,
        userId: reading.readerId,
        operation: "reader_sms",
      },
    );
    return;
  }

  const [delivery] = await db
    .insert(notificationDeliveries)
    .values({
      readingId: reading.id,
      recipientId: reading.readerId,
      channel: "sms",
    })
    .onConflictDoNothing()
    .returning({ id: notificationDeliveries.id });
  if (!delivery) return;

  try {
    const providerMessageId = await sendSms(env, {
      to: settings.phoneNumber,
      text: `New ${reading.type} reading request on SoulSeer. Open https://soul-seer.net/dashboard to accept. Reply STOP to opt out.`,
    });
    await db
      .update(notificationDeliveries)
      .set({
        status: "sent",
        providerMessageId,
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, delivery.id));
  } catch (error) {
    const failureCode =
      error instanceof SmsProviderError
        ? (error.providerCodes[0] ?? String(error.providerStatus))
        : "request_failed";
    await db
      .update(notificationDeliveries)
      .set({ status: "failed", failureCode, updatedAt: new Date() })
      .where(
        and(
          eq(notificationDeliveries.id, delivery.id),
          eq(notificationDeliveries.status, "pending"),
        ),
      );
    logger.error(
      "Reader SMS notification failed",
      {
        readingId: reading.id,
        userId: reading.readerId,
        operation: "reader_sms",
      },
      error instanceof SmsProviderError
        ? {
            providerStatus: error.providerStatus,
            providerCodes: error.providerCodes,
          }
        : { error: error instanceof Error ? error.message : String(error) },
    );
  }
}
