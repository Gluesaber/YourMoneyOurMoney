import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { computeBalances } from "./ledger.js";

// Loads one user's accounts and transactions and computes every balance. Both GET /api/accounts and
// GET /api/summary use this, so the two can never disagree (F-05 §2.1). The arithmetic itself stays in
// the pure ledger.ts; this module only reads the database.
// `client` lets the BR-14 check (L7-01) read inside the save transaction, after its row locks; reads use the default.
export async function loadLedger(
  userId: number,
  client: PrismaClient | Prisma.TransactionClient = getPrisma(),
) {
  const prisma = client;
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId },
      select: {
        kind: true,
        sourceAccountId: true,
        totalAmount: true,
        lines: { select: { accountId: true, amount: true } },
      },
    }),
  ]);
  return { accounts, balances: computeBalances(accounts, transactions) };
}
