import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { topUpIntentSchema, walletLedgerEntries } from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";
import { createStripe } from "../providers/stripe";

export const paymentRoutes = new Hono<AppBindings>();

paymentRoutes.post("/create-intent", requireUser, async (context) => {
  const input = topUpIntentSchema.parse(await context.req.json());
  const user = context.get("user");
  const stripe = createStripe(context.env);
  const intent = await stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: "SoulSeer account balance top-up",
      metadata: {
        purpose: "wallet_top_up",
        soulseerUserId: user.id,
        amountCents: String(input.amountCents),
      },
    },
    {
      idempotencyKey:
        context.req.header("Idempotency-Key") ?? crypto.randomUUID(),
    },
  );
  return context.json({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  });
});

paymentRoutes.get("/transactions", requireUser, async (context) => {
  const user = context.get("user");
  const { db } = createDatabase(context.env.DATABASE_URL);
  const entries = await db
    .select()
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.userId, user.id))
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(200);
  return context.json({ transactions: entries });
});
