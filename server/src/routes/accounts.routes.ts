import { Router } from "express";
import { z } from "zod";
import type { Account, AccountType } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { assertOwned } from "../lib/ownership.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import { computeBalances } from "../services/ledger.js";

// F-03 Accounts and opening balances — docs/sprints/sprint-1/F-03-accounts.md.
export const accountsRouter = Router();

accountsRouter.use(requireUser, requireRole("USER"));

// PostgreSQL INTEGER limit: the most satang one value can hold, and the largest valid id.
const MAX_INT = 2_147_483_647;

// Contract §3: by type in this order, then by name A→Z.
const TYPE_ORDER: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"];

// BR-12.
const OPENING_BALANCE_TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN"];

// A real calendar date in YYYY-MM-DD: "2026-02-30" has the right shape but does not exist.
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((s) => toDateOnly(new Date(`${s}T00:00:00.000Z`)) === s, "Not a real calendar date.");

const openingBalanceBody = z.object({
  openingBalance: z.number().int().min(0).max(MAX_INT),
  openingDate: calendarDate,
});

accountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const accounts = await loadAccountsWithBalances(userId);
    res.json({ accounts });
  }),
);

accountsRouter.put(
  "/:id/opening-balance",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = openingBalanceBody.parse(req.body);
    const id = parseId(req.params.id);

    const prisma = getPrisma();
    const account = assertOwned(
      id === null ? null : await prisma.account.findUnique({ where: { id } }),
      userId,
    );
    if (!OPENING_BALANCE_TYPES.includes(account.type)) {
      throw new AppError(
        400,
        ErrorCode.INVALID_ACCOUNT_TYPE,
        "Only cash and loan accounts can have an opening balance.",
        { type: account.type },
      );
    }

    await prisma.account.update({
      where: { id: account.id },
      data: {
        openingBalance: body.openingBalance,
        openingDate: new Date(`${body.openingDate}T00:00:00.000Z`),
      },
    });

    const updated = (await loadAccountsWithBalances(userId)).find((a) => a.id === account.id)!;
    res.json({ account: updated });
  }),
);

async function loadAccountsWithBalances(userId: number) {
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
  const balances = computeBalances(accounts, transactions);

  return accounts
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name))
    .map((a) => toAccountResponse(a, balances.get(a.id)!));
}

function toAccountResponse(a: Account, balance: number) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    subtype: a.subtype,
    openingBalance: a.openingBalance,
    openingDate: a.openingDate ? toDateOnly(a.openingDate) : null,
    balance,
  };
}

// A non-numeric or out-of-range id is treated as "not found" (contract §2).
function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_INT ? id : null;
}

function toDateOnly(d: Date): string {
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
