import { Hono } from "hono";
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  FORUM_PAGE_SIZE,
  createForumCommentSchema,
  createForumPostSchema,
  flagContentSchema,
  forumComments,
  forumFlags,
  forumPosts,
  paginationSchema,
  users,
} from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireRole, requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";
import { AppError } from "../lib/errors";
import { validateUuidParams } from "../lib/http";

export const forumRoutes = new Hono<AppBindings>();

forumRoutes.get("/posts", async (context) => {
  const { page } = paginationSchema.parse(context.req.query());
  const { db } = createDatabase(context.env.DATABASE_URL);
  const rows = await db
    .select({
      id: forumPosts.id,
      title: forumPosts.title,
      body: forumPosts.body,
      category: forumPosts.category,
      isLocked: forumPosts.isLocked,
      createdAt: forumPosts.createdAt,
      authorName: users.username,
      commentCount: count(forumComments.id),
    })
    .from(forumPosts)
    .innerJoin(users, eq(users.id, forumPosts.authorId))
    .leftJoin(
      forumComments,
      and(
        eq(forumComments.postId, forumPosts.id),
        eq(forumComments.status, "visible"),
      ),
    )
    .where(eq(forumPosts.status, "visible"))
    .groupBy(forumPosts.id, users.username)
    .orderBy(desc(forumPosts.createdAt))
    .limit(FORUM_PAGE_SIZE)
    .offset((page - 1) * FORUM_PAGE_SIZE);
  return context.json({ posts: rows, page, pageSize: FORUM_PAGE_SIZE });
});

forumRoutes.post("/posts", requireUser, async (context) => {
  const input = createForumPostSchema.parse(await context.req.json());
  const user = context.get("user");
  if (input.category === "announcements" && user.role !== "admin") {
    throw new AppError(
      403,
      "ANNOUNCEMENTS_ADMIN_ONLY",
      "Only Admins may publish announcements.",
    );
  }
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [post] = await db
    .insert(forumPosts)
    .values({ ...input, authorId: user.id })
    .returning();
  return context.json({ post }, 201);
});

forumRoutes.get("/posts/:id", validateUuidParams("id"), async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [post] = await db
    .select({
      id: forumPosts.id,
      title: forumPosts.title,
      body: forumPosts.body,
      category: forumPosts.category,
      isLocked: forumPosts.isLocked,
      createdAt: forumPosts.createdAt,
      authorName: users.username,
    })
    .from(forumPosts)
    .innerJoin(users, eq(users.id, forumPosts.authorId))
    .where(
      and(
        eq(forumPosts.id, context.req.param("id")),
        eq(forumPosts.status, "visible"),
      ),
    )
    .limit(1);
  if (!post) throw new AppError(404, "POST_NOT_FOUND", "Forum post not found.");
  const comments = await db
    .select({
      id: forumComments.id,
      parentId: forumComments.parentId,
      body: forumComments.body,
      createdAt: forumComments.createdAt,
      authorName: users.username,
    })
    .from(forumComments)
    .innerJoin(users, eq(users.id, forumComments.authorId))
    .where(
      and(
        eq(forumComments.postId, post.id),
        eq(forumComments.status, "visible"),
      ),
    )
    .orderBy(asc(forumComments.createdAt));
  return context.json({ post, comments });
});

forumRoutes.post("/posts/:id/comments", requireUser, validateUuidParams("id"), async (context) => {
  const input = createForumCommentSchema.parse(await context.req.json());
  const postId = context.req.param("id");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [post] = await db
    .select()
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);
  if (!post || post.status !== "visible")
    throw new AppError(404, "POST_NOT_FOUND", "Forum post not found.");
  if (post.isLocked)
    throw new AppError(409, "POST_LOCKED", "This discussion is locked.");
  if (input.parentId) {
    const [parent] = await db
      .select({
        parentId: forumComments.parentId,
        postId: forumComments.postId,
      })
      .from(forumComments)
      .where(eq(forumComments.id, input.parentId))
      .limit(1);
    if (!parent || parent.postId !== postId || parent.parentId) {
      throw new AppError(
        400,
        "INVALID_COMMENT_PARENT",
        "Replies may be nested one level only.",
      );
    }
  }
  const [comment] = await db
    .insert(forumComments)
    .values({ postId, authorId: context.get("user").id, ...input })
    .returning();
  return context.json({ comment }, 201);
});

forumRoutes.post("/posts/:id/flag", requireUser, validateUuidParams("id"), async (context) => {
  const body = (await context.req.json()) as { reason?: string };
  const input = flagContentSchema.parse({
    reason: body.reason,
    postId: context.req.param("id"),
  });
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [flag] = await db
    .insert(forumFlags)
    .values({ reporterId: context.get("user").id, ...input })
    .returning();
  return context.json({ flag }, 201);
});

forumRoutes.post("/comments/:id/flag", requireUser, validateUuidParams("id"), async (context) => {
  const body = (await context.req.json()) as { reason?: string };
  const input = flagContentSchema.parse({
    reason: body.reason,
    commentId: context.req.param("id"),
  });
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [flag] = await db
    .insert(forumFlags)
    .values({ reporterId: context.get("user").id, ...input })
    .returning();
  return context.json({ flag }, 201);
});

forumRoutes.delete(
  "/posts/:id",
  requireUser,
  requireRole("admin"),
  validateUuidParams("id"),
  async (context) => {
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [post] = await db
      .update(forumPosts)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(forumPosts.id, context.req.param("id")))
      .returning();
    if (!post)
      throw new AppError(404, "POST_NOT_FOUND", "Forum post not found.");
    return context.json({ deleted: true });
  },
);

forumRoutes.delete(
  "/comments/:id",
  requireUser,
  requireRole("admin"),
  validateUuidParams("id"),
  async (context) => {
    const { db } = createDatabase(context.env.DATABASE_URL);
    const [comment] = await db
      .update(forumComments)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(forumComments.id, context.req.param("id")))
      .returning();
    if (!comment)
      throw new AppError(404, "COMMENT_NOT_FOUND", "Forum comment not found.");
    return context.json({ deleted: true });
  },
);
