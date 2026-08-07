import { z } from "zod";
import {
  COMMUNITY_CATEGORIES,
  MAX_DIRECT_MESSAGE_LENGTH,
  MAX_PAID_REPLY_CENTS,
  MAX_PROFILE_IMAGE_BYTES,
  MIN_PAID_REPLY_CENTS,
  MINIMUM_TOP_UP_CENTS,
  READING_TYPES,
  USER_ROLES,
} from "./constants";

const trimmedText = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const uuidSchema = z.string().uuid();
export const roleSchema = z.enum(USER_ROLES);
export const readingTypeSchema = z.enum(READING_TYPES);
export const forumCategorySchema = z.enum(COMMUNITY_CATEGORIES);

export const bootstrapProfileSchema = z.object({
  username: trimmedText(3, 40).regex(/^[a-zA-Z0-9_.-]+$/),
  fullName: trimmedText(2, 100),
  readerInviteToken: trimmedText(32, 512).optional(),
});

export const readerPricingSchema = z.object({
  chat: z.number().int().min(100).max(100_000),
  voice: z.number().int().min(100).max(100_000),
  video: z.number().int().min(100).max(100_000),
});

export const readerProfileUpdateSchema = z.object({
  bio: trimmedText(1, 4_000).optional(),
  specialties: z.array(trimmedText(1, 60)).max(20).optional(),
});

export const readerStatusSchema = z.object({ isOnline: z.boolean() });

export const readerNotificationSettingsSchema = z
  .object({
    phoneNumber: z
      .string()
      .trim()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Use international format, such as +15551234567.",
      )
      .nullable(),
    smsNotificationsEnabled: z.boolean(),
  })
  .refine(
    (value) => !value.smsNotificationsEnabled || Boolean(value.phoneNumber),
    {
      message: "Add a mobile number before enabling text notifications.",
      path: ["phoneNumber"],
    },
  );

export const startConversationSchema = z.object({
  readerId: uuidSchema,
  body: trimmedText(1, MAX_DIRECT_MESSAGE_LENGTH),
});

export const sendDirectMessageSchema = z.discriminatedUnion("paid", [
  z.object({
    body: trimmedText(1, MAX_DIRECT_MESSAGE_LENGTH),
    paid: z.literal(false),
  }),
  z.object({
    body: trimmedText(1, MAX_DIRECT_MESSAGE_LENGTH),
    paid: z.literal(true),
    priceCents: z
      .number()
      .int()
      .min(MIN_PAID_REPLY_CENTS)
      .max(MAX_PAID_REPLY_CENTS),
  }),
]);

export const createReaderSchema = z.object({
  email: z.string().trim().email().max(254),
  username: trimmedText(3, 40).regex(/^[a-zA-Z0-9_.-]+$/),
  fullName: trimmedText(2, 100),
  bio: trimmedText(1, 4_000),
  specialties: z.array(trimmedText(1, 60)).min(1).max(20),
  pricing: readerPricingSchema,
  verified: z.boolean().default(false),
});

export const createReadingSchema = z.object({
  readerId: uuidSchema,
  type: readingTypeSchema,
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: trimmedText(1, 2_000).optional(),
});

export const topUpIntentSchema = z.object({
  amountCents: z.number().int().min(MINIMUM_TOP_UP_CENTS).max(100_000),
});

export const createForumPostSchema = z.object({
  title: trimmedText(4, 160),
  body: trimmedText(10, 20_000),
  category: forumCategorySchema,
});

export const createForumCommentSchema = z.object({
  body: trimmedText(1, 8_000),
  parentId: uuidSchema.optional(),
});

export const flagContentSchema = z
  .object({
    postId: uuidSchema.optional(),
    commentId: uuidSchema.optional(),
    reason: trimmedText(5, 1_000),
  })
  .refine(
    (value) =>
      Number(Boolean(value.postId)) + Number(Boolean(value.commentId)) === 1,
    {
      message: "Exactly one content target is required.",
    },
  );

export const adminBalanceAdjustmentSchema = z.object({
  userId: uuidSchema,
  amountCents: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0),
  reason: trimmedText(5, 1_000),
  idempotencyKey: trimmedText(8, 200),
});

export const adminRefundSchema = z.object({
  reason: trimmedText(5, 1_000),
  idempotencyKey: trimmedText(8, 200),
});

export const newsletterSchema = z.object({
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
});

export const profileImageMetadataSchema = z.object({
  fileName: trimmedText(1, 255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(MAX_PROFILE_IMAGE_BYTES),
});

export const realtimeKitEventSchema = z.object({
  event: z.enum([
    "meeting.started",
    "meeting.ended",
    "meeting.participantJoined",
    "meeting.participantLeft",
    "meeting.chatSynced",
  ]),
  meeting: z
    .object({
      id: z.string().min(1),
      sessionId: z.string().min(1).optional(),
      startedAt: z.string().datetime().optional(),
      endedAt: z.string().datetime().optional(),
    })
    .optional(),
  meetingId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  participant: z
    .object({
      peerId: z.string().min(1),
      customParticipantId: uuidSchema,
      joinedAt: z.string().datetime().optional(),
      leftAt: z.string().datetime().optional(),
    })
    .optional(),
  chatDownloadUrl: z.string().url().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export type AuthenticatedUser = {
  id: string;
  neonAuthUserId: string;
  email: string;
  username: string;
  fullName: string;
  role: z.infer<typeof roleSchema>;
  status: "active" | "suspended" | "deleted";
};

export type ApiErrorShape = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};
