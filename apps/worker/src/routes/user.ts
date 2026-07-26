import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { walletLedgerEntries, wallets } from "@soulseer/shared";
import type { AppBindings } from "../types";
import { requireUser } from "../lib/auth";
import { createDatabase } from "../lib/db";

export const userRoutes = new Hono<AppBindings>();
userRoutes.use("*", requireUser);

userRoutes.get("/balance", async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const [wallet] = await db
    .select({
      availableBalance: wallets.availableBalance,
      currency: wallets.currency,
    })
    .from(wallets)
    .where(eq(wallets.userId, context.get("user").id))
    .limit(1);
  return context.json({
    balance: wallet?.availableBalance ?? 0,
    currency: wallet?.currency ?? "usd",
  });
});

export const transactionRoutes = new Hono<AppBindings>();
transactionRoutes.get("/", requireUser, async (context) => {
  const { db } = createDatabase(context.env.DATABASE_URL);
  const transactions = await db
    .select()
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.userId, context.get("user").id))
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(200);
  return context.json({ transactions });
});
