import { DurableObject } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import {
  BILLING_INTERVAL_MS,
  RECONNECTION_GRACE_MS,
  readingSessions,
} from "@soulseer/shared";
import { createDatabase } from "../lib/db";
import { logger } from "../lib/log";
import { disableMeeting, endSession } from "../providers/realtimekit";

type ParticipantRole = "client" | "reader";
type ParticipantPresence = Record<ParticipantRole, boolean>;

type CoordinatorState = {
  readingId: string;
  meetingId: string;
  clientId: string;
  readerId: string;
  presence: ParticipantPresence;
  status: "initialized" | "active" | "ending" | "ended";
  startedAtMs: number | null;
  connectedSinceMs: number | null;
  connectedAccumulatedMs: number;
  disconnectedAtMs: number | null;
  graceDeadlineMs: number | null;
  nextBillAtMs: number | null;
  billingSequence: number;
  finalizationStarted: boolean;
  endAtMs: number | null;
  endReason: string | null;
};

type ProviderPresenceEvent = {
  type: "participant_joined" | "participant_left" | "meeting_ended";
  appUserId?: string | undefined;
  occurredAt: string;
  sessionId?: string | undefined;
};

type BillingResult = {
  result: "billed" | "duplicate" | "insufficient_balance" | "not_active";
  sequence?: number;
  nextBillAt?: string | null;
  totalPrice?: number;
};

const STATE_KEY = "coordinator-state";

export class ReadingCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async initialize(input: {
    readingId: string;
    meetingId: string;
    clientId: string;
    readerId: string;
  }): Promise<void> {
    const existing = await this.ctx.storage.get<CoordinatorState>(STATE_KEY);
    if (existing) return;
    const state: CoordinatorState = {
      ...input,
      presence: { client: false, reader: false },
      status: "initialized",
      startedAtMs: null,
      connectedSinceMs: null,
      connectedAccumulatedMs: 0,
      disconnectedAtMs: null,
      graceDeadlineMs: null,
      nextBillAtMs: null,
      billingSequence: 0,
      finalizationStarted: false,
      endAtMs: null,
      endReason: null,
    };
    await this.ctx.storage.put(STATE_KEY, state);
  }

  async providerEvent(event: ProviderPresenceEvent): Promise<void> {
    const state = await this.mustState();
    if (state.status === "ended") return;
    const occurredAtMs = new Date(event.occurredAt).getTime();
    const eventTime = Number.isFinite(occurredAtMs) ? occurredAtMs : Date.now();

    if (event.type === "meeting_ended") {
      await this.finalize(state, eventTime, "provider_meeting_ended");
      return;
    }

    const role = this.roleForUser(state, event.appUserId);
    if (!role) return;

    if (event.type === "participant_joined") {
      state.presence[role] = true;
      if (state.presence.client && state.presence.reader) {
        await this.activateOrReconnect(state, eventTime, event.sessionId);
      } else {
        await this.persistAndSchedule(state);
      }
      return;
    }

    state.presence[role] = false;
    if (state.connectedSinceMs !== null) {
      state.connectedAccumulatedMs += Math.max(
        0,
        eventTime - state.connectedSinceMs,
      );
      state.connectedSinceMs = null;
    }
    state.disconnectedAtMs = eventTime;
    state.graceDeadlineMs = eventTime + RECONNECTION_GRACE_MS;
    await this.persistAndSchedule(state);
  }

  async requestEnd(requestedById: string): Promise<void> {
    const state = await this.mustState();
    if (requestedById !== state.clientId && requestedById !== state.readerId) {
      throw new Error("Only assigned participants may end this reading.");
    }
    await this.finalize(state, Date.now(), "participant_requested_end");
  }

  async getSnapshot(): Promise<CoordinatorState> {
    return this.mustState();
  }

  override async alarm(): Promise<void> {
    const state = await this.mustState();
    if (state.status === "ended") {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    if (state.status === "ending" && !state.finalizationStarted) {
      await this.finalize(
        state,
        state.endAtMs ?? Date.now(),
        state.endReason ?? "finalization_retry",
      );
      return;
    }

    const now = Date.now();
    if (state.graceDeadlineMs !== null && state.graceDeadlineMs <= now) {
      await this.finalize(
        state,
        state.graceDeadlineMs,
        "reconnection_grace_expired",
      );
      return;
    }

    if (
      state.nextBillAtMs !== null &&
      state.nextBillAtMs <= now &&
      state.status === "active"
    ) {
      await this.billMinute(state);
    }
    await this.persistAndSchedule(state);
  }

  private async activateOrReconnect(
    state: CoordinatorState,
    occurredAtMs: number,
    sessionId?: string,
  ): Promise<void> {
    const isFirstActivation = state.startedAtMs === null;
    state.disconnectedAtMs = null;
    state.graceDeadlineMs = null;
    state.connectedSinceMs ??= occurredAtMs;

    if (isFirstActivation) {
      state.startedAtMs = occurredAtMs;
      state.status = "active";
      state.nextBillAtMs = occurredAtMs + BILLING_INTERVAL_MS;
      const { db } = createDatabase(this.env.DATABASE_URL);
      await db
        .update(readingSessions)
        .set({
          status: "active",
          startedAt: new Date(occurredAtMs),
          nextBillAt: new Date(state.nextBillAtMs),
          ...(sessionId ? { cloudflareSessionId: sessionId } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(readingSessions.id, state.readingId),
            inArray(readingSessions.status, [
              "accepted",
              "preflight",
              "connecting",
            ]),
          ),
        );
    } else if (state.nextBillAtMs === null) {
      state.nextBillAtMs = occurredAtMs + BILLING_INTERVAL_MS;
      const { db } = createDatabase(this.env.DATABASE_URL);
      await db
        .update(readingSessions)
        .set({
          nextBillAt: new Date(state.nextBillAtMs),
          updatedAt: new Date(),
        })
        .where(eq(readingSessions.id, state.readingId));
    }
    await this.persistAndSchedule(state);
  }

  private async billMinute(state: CoordinatorState): Promise<void> {
    if (state.nextBillAtMs === null) return;
    const sequence = state.billingSequence + 1;
    const billedAt = new Date(state.nextBillAtMs);
    const { sql } = createDatabase(this.env.DATABASE_URL);
    const response = await sql`
      SELECT public.bill_reading_minute(
        ${state.readingId}::uuid,
        ${sequence}::integer,
        ${billedAt.toISOString()}::timestamptz
      ) AS result
    `;
    const result = (response.rows[0]?.result ?? null) as BillingResult | null;
    if (!result) throw new Error("Billing function returned no result.");

    if (result.result === "insufficient_balance") {
      state.status = "ending";
      state.nextBillAtMs = null;
      await this.persistAndSchedule(state);
      await this.finalize(state, Date.now(), "insufficient_balance");
      return;
    }
    if (result.result === "not_active") {
      state.nextBillAtMs = null;
      return;
    }

    state.billingSequence = result.sequence ?? sequence;
    if (state.presence.client && state.presence.reader) {
      state.nextBillAtMs = result.nextBillAt
        ? new Date(result.nextBillAt).getTime()
        : billedAt.getTime() + BILLING_INTERVAL_MS;
    } else {
      // A participant who leaves still completes the already-earned minute; new billing pauses afterward.
      state.nextBillAtMs = null;
      const { db } = createDatabase(this.env.DATABASE_URL);
      await db
        .update(readingSessions)
        .set({ nextBillAt: null, updatedAt: new Date() })
        .where(eq(readingSessions.id, state.readingId));
    }
  }

  private async finalize(
    state: CoordinatorState,
    endedAtMs: number,
    reason: string,
  ): Promise<void> {
    if (state.status === "ended" || state.finalizationStarted) return;
    state.finalizationStarted = true;
    state.status = "ending";
    state.endAtMs = endedAtMs;
    state.endReason = reason;
    if (state.connectedSinceMs !== null) {
      state.connectedAccumulatedMs += Math.max(
        0,
        endedAtMs - state.connectedSinceMs,
      );
      state.connectedSinceMs = null;
    }
    state.nextBillAtMs = null;
    state.graceDeadlineMs = null;
    await this.ctx.storage.put(STATE_KEY, state);
    await this.ctx.storage.deleteAlarm();

    try {
      await endSession(this.env, state.meetingId);
      await disableMeeting(this.env, state.meetingId);
      const durationSeconds = Math.max(
        0,
        Math.floor(state.connectedAccumulatedMs / 1000),
      );
      const { db } = createDatabase(this.env.DATABASE_URL);
      await db
        .update(readingSessions)
        .set({
          status: "ended",
          completedAt: new Date(endedAtMs),
          durationSeconds,
          nextBillAt: null,
          failureReason: reason === "participant_requested_end" ? null : reason,
          updatedAt: new Date(),
        })
        .where(eq(readingSessions.id, state.readingId));
      state.status = "ended";
      await this.ctx.storage.put(STATE_KEY, state);
      logger.info(
        "Reading finalized",
        { readingId: state.readingId, operation: "finalize" },
        { reason, durationSeconds },
      );
    } catch (error) {
      state.finalizationStarted = false;
      await this.ctx.storage.put(STATE_KEY, state);
      await this.ctx.storage.setAlarm(Date.now() + 5_000);
      throw error;
    }
  }

  private roleForUser(
    state: CoordinatorState,
    userId: string | undefined,
  ): ParticipantRole | null {
    if (userId === state.clientId) return "client";
    if (userId === state.readerId) return "reader";
    return null;
  }

  private async persistAndSchedule(state: CoordinatorState): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, state);
    const candidates = [state.nextBillAtMs, state.graceDeadlineMs].filter(
      (value): value is number => value !== null,
    );
    if (candidates.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...candidates));
  }

  private async mustState(): Promise<CoordinatorState> {
    const state = await this.ctx.storage.get<CoordinatorState>(STATE_KEY);
    if (!state)
      throw new Error("Reading coordinator has not been initialized.");
    return state;
  }
}
