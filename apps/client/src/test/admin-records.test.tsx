import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createReaderSchema, readerProfileUpdateSchema } from "@soulseer/shared";
import { ReadingRecordModal } from "../components/admin-records";
import { transcriptLine } from "../lib/transcript";

const api = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("accepts a Reader invitation without a bio or specialties", () => {
  const parsed = createReaderSchema.parse({
    email: "reader@example.com",
    username: "TarotIlluminae",
    fullName: "Brooke",
    pricing: { chat: 500, voice: 700, video: 1000 },
  });
  expect(parsed.bio).toBe("");
  expect(parsed.specialties).toEqual([]);
  // ...and the invited Reader can then save their profile with the bio still empty.
  expect(readerProfileUpdateSchema.parse({ bio: "", specialties: ["Tarot"] })).toEqual({ bio: "", specialties: ["Tarot"] });
});

it("reads common RealtimeKit chat fields and keeps unknown entries visible", () => {
  expect(transcriptLine({ displayName: "Brooke", message: "Hello", createdAt: "2026-10-01T10:00:00Z" })).toEqual({
    who: "Brooke",
    when: "2026-10-01T10:00:00.000Z",
    text: "Hello",
  });
  expect(transcriptLine({ unexpected: true }).text).toBe('{"unexpected":true}');
  expect(transcriptLine({ text: "hi", time: "not a date" }).when).toBeNull();
});

it("shows the people, transcript and charges for a reading", async () => {
  api.mockResolvedValue({
    reading: {
      id: "reading-1",
      type: "chat",
      status: "ended",
      pricePerMinute: 500,
      createdAt: "2026-10-01T10:00:00Z",
      startedAt: "2026-10-01T10:01:00Z",
      completedAt: "2026-10-01T10:11:00Z",
      durationSeconds: 600,
      totalPrice: 5000,
      paymentStatus: "captured",
      failureReason: null,
      endedById: "client-1",
      chatTranscript: [{ displayName: "Client Name", message: "Will I find love?" }],
      client: { id: "client-1", fullName: "Client Name", username: "client", email: "client@example.com" },
      reader: { id: "reader-1", fullName: "Reader Name", username: "reader", email: "reader@example.com" },
    },
    events: [{ id: "e1", eventType: "meeting.started", occurredAt: "2026-10-01T10:01:00Z" }],
    ledger: [{ id: "l1", userId: "client-1", type: "reading_charge", amount: -5000, reason: null, createdAt: "2026-10-01T10:11:00Z" }],
  });
  render(<ReadingRecordModal readingId="reading-1" onClose={vi.fn()} />);
  expect(await screen.findByText("Will I find love?")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("/admin/readings/reading-1");
  expect(screen.getByText(/Reader Name \(@reader/)).toBeInTheDocument();
  expect(screen.getByText("meeting.started")).toBeInTheDocument();
  expect(screen.getByText(/ended by Client Name/)).toBeInTheDocument();
});
