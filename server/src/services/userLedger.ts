import { getPrisma } from "../prisma.js";
import { computeBalances } from "./ledger.js";

// Loads one user's accounts and transactions and computes every balance. Both GET /api/accounts and
// GET /api/summary use this, so the two can never disagree (F-05 §2.1). The arithmetic itself stays in
// the pure ledger.ts; this module only reads the database.
export async function loadLedger(userId: number) {
  const prisma = getPrisma();
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
