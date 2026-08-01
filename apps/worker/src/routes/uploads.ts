import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  MAX_PROFILE_IMAGE_BYTES,
  profileImageMetadataSchema,
  readerProfiles,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { signUploadCapability, verifyUploadCapability } from "../lib/crypto";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";

type UploadCapability = {
  userId: string;
  key: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  expiresAt: number;
};

export const uploadRoutes = new Hono<AppBindings>();

uploadRoutes.post(
  "/reader-image/capability",
  requireUser,
  requireRole("reader", "admin"),
  async (context) => {
    const input = profileImageMetadataSchema.parse(await context.req.json());
    const actor = context.get("user");
    const targetUserId =
      actor.role === "admin" ? context.req.query("readerId") : actor.id;
    if (!targetUserId)
      throw new AppError(400, "READER_REQUIRED", "A Reader id is required.");
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [reader] = await db
      .select({ id: readerProfiles.userId })
      .from(readerProfiles)
      .where(eq(readerProfiles.userId, targetUserId))
      .limit(1);
    if (!reader)
      throw new AppError(404, "READER_NOT_FOUND", "Reader not found.");
    const extension =
      input.contentType === "image/jpeg"
        ? "jpg"
        : input.contentType === "image/png"
          ? "png"
          : "webp";
    const capability: UploadCapability = {
      userId: targetUserId,
      key: `readers/${targetUserId}/${crypto.randomUUID()}.${extension}`,
      contentType: input.contentType,
      size: input.size,
      expiresAt: Date.now() + 5 * 60_000,
    };
    const encoded = btoa(JSON.stringify(capability));
    const signature = await signUploadCapability(
      encoded,
      context.env.UPLOAD_SIGNING_SECRET,
    );
    return context.json({
      capability: encoded,
      signature,
      expiresAt: capability.expiresAt,
    });
  },
);

uploadRoutes.put(
  "/reader-image",
  requireUser,
  requireRole("reader", "admin"),
  async (context) => {
    const encoded = context.req.header("X-SoulSeer-Upload-Capability");
    const signature = context.req.header("X-SoulSeer-Upload-Signature");
    if (!encoded || !signature)
      throw new AppError(
        401,
        "UPLOAD_CAPABILITY_REQUIRED",
        "Upload authorization is missing.",
      );
    if (
      !(await verifyUploadCapability(
        encoded,
        signature,
        context.env.UPLOAD_SIGNING_SECRET,
      ))
    ) {
      throw new AppError(
        401,
        "INVALID_UPLOAD_CAPABILITY",
        "Upload authorization is invalid.",
      );
    }
    let capability: UploadCapability;
    try {
      capability = JSON.parse(atob(encoded)) as UploadCapability;
    } catch {
      throw new AppError(
        400,
        "INVALID_UPLOAD_CAPABILITY",
        "Upload authorization is malformed.",
      );
    }
    const actor = context.get("user");
    if (actor.role !== "admin" && capability.userId !== actor.id) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "This upload belongs to a different Reader.",
      );
    }
    if (capability.expiresAt < Date.now())
      throw new AppError(
        410,
        "UPLOAD_EXPIRED",
        "Upload authorization has expired.",
      );
    const bytes = new Uint8Array(await context.req.arrayBuffer());
    if (
      bytes.byteLength !== capability.size ||
      bytes.byteLength > MAX_PROFILE_IMAGE_BYTES
    ) {
      throw new AppError(
        400,
        "INVALID_IMAGE_SIZE",
        "The uploaded image size does not match its authorization.",
      );
    }
    if (context.req.header("Content-Type") !== capability.contentType) {
      throw new AppError(
        400,
        "INVALID_IMAGE_TYPE",
        "The uploaded image type does not match its authorization.",
      );
    }
    if (!matchesImageSignature(bytes, capability.contentType)) {
      throw new AppError(
        400,
        "INVALID_IMAGE_BYTES",
        "The uploaded file is not a supported image.",
      );
    }
    await context.env.PROFILE_IMAGES.put(capability.key, bytes, {
      httpMetadata: {
        contentType: capability.contentType,
        cacheControl: "public, max-age=3600",
      },
      customMetadata: { ownerId: capability.userId, uploadedBy: actor.id },
    });
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [previous] = await db
      .select({ key: readerProfiles.profileImageKey })
      .from(readerProfiles)
      .where(eq(readerProfiles.userId, capability.userId))
      .limit(1);
    await db
      .update(readerProfiles)
      .set({ profileImageKey: capability.key, updatedAt: new Date() })
      .where(eq(readerProfiles.userId, capability.userId));
    if (previous?.key && previous.key !== capability.key) {
      context.executionCtx.waitUntil(
        context.env.PROFILE_IMAGES.delete(previous.key),
      );
    }
    return context.json({ key: capability.key });
  },
);

function matchesImageSignature(
  bytes: Uint8Array,
  contentType: UploadCapability["contentType"],
): boolean {
  if (bytes.byteLength < 12) return false;
  if (contentType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") {
    return bytes
      .slice(0, 8)
      .every(
        (byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index],
      );
  }
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  );
}
