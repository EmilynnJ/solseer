export const BRAND = {
  name: "SoulSeer",
  tagline: "A Community of Gifted Psychics",
  backgroundImage: "/images/soulseer-ethereal-background.webp",
  heroImage: "/images/soulseer-hero-logo.jpg",
  founderImage: "https://i.postimg.cc/s2ds9RtC/FOUNDER.jpg",
} as const;

export const COMMUNITY_CATEGORIES = [
  "general",
  "readings",
  "spiritual_growth",
  "ask_a_reader",
  "announcements",
] as const;

export const READING_TYPES = ["chat", "voice", "video"] as const;
export const USER_ROLES = ["client", "reader", "admin"] as const;
export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export const READING_STATUSES = [
  "pending",
  "accepted",
  "preflight",
  "connecting",
  "active",
  "ending",
  "ended",
  "failed",
  "cancelled",
] as const;

export const FORUM_PAGE_SIZE = 10;
export const MINIMUM_TOP_UP_CENTS = 500;
export const TOP_UP_PRESETS_CENTS = [1000, 2500, 5000, 10000] as const;
export const READER_SHARE_BASIS_POINTS = 7000;
export const PLATFORM_SHARE_BASIS_POINTS = 3000;
export const READER_PAYOUT_THRESHOLD_CENTS = 1500;
export const READER_HEARTBEAT_FRESH_MS = 90_000;
export const BILLING_INTERVAL_MS = 60_000;
export const RECONNECTION_GRACE_MS = 120_000;
export const LOW_BALANCE_MINUTES = 2;
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export function splitReadingCharge(totalCents: number): {
  readerCents: number;
  platformCents: number;
} {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new RangeError(
      "Reading charge must be a non-negative integer number of cents.",
    );
  }

  // The reader share rounds down to the nearest cent. The platform receives the remainder.
  const readerCents = Math.floor(
    (totalCents * READER_SHARE_BASIS_POINTS) / 10_000,
  );
  return { readerCents, platformCents: totalCents - readerCents };
}
