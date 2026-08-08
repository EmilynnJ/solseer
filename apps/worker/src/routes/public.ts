import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { newsletterSchema, newsletterSubscribers } from "@soulseer/shared";
import type { AppBindings } from "../types";
import { createDatabase } from "../lib/db";

export const publicRoutes = new Hono<AppBindings>();

publicRoutes.get("/health", (context) =>
  context.json({
    status: "ok",
    service: "soulseer-api",
    environment: context.env.ENVIRONMENT,
  }),
);

publicRoutes.post("/newsletter", async (context) => {
  const input = newsletterSchema.parse(await context.req.json());
  const { db } = createDatabase(context.env.DATABASE_URL);
  const email = input.email.toLowerCase();
  let [subscriber] = await db
    .insert(newsletterSubscribers)
    .values({ email, consentSource: "website_home" })
    .onConflictDoNothing()
    .returning({
      id: newsletterSubscribers.id,
      status: newsletterSubscribers.status,
    });
  if (!subscriber) {
    [subscriber] = await db
      .update(newsletterSubscribers)
      .set({ status: "subscribed", updatedAt: new Date() })
      .where(eq(newsletterSubscribers.email, email))
      .returning({
        id: newsletterSubscribers.id,
        status: newsletterSubscribers.status,
      });
  }
  return context.json({ subscriber }, 201);
});
