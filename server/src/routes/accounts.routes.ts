import { Router } from "express";
import { z } from "zod";
import type { Account, AccountType } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { assertOwned } from "../lib/ownership.js";
import { MAX_INT, calendarDate, fromDateOnly, parseId, toDateOnly } from "../lib/validation.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import { loadLedger } from "../services/userLedger.js";

// F-03 Accounts and opening balances — docs/sprints/sprint-1/F-03-accounts.md.
export const accountsRouter = Router();

accountsRouter.use(requireUser, requireRole("USER"));

// Contract §3: by type in this order, then by name A→Z.
const TYPE_ORDER: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"];

// BR-12.
const OPENING_BALANCE_TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN"];

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
        openingDate: fromDateOnly(body.openingDate),
      },
    });

    const updated = (await loadAccountsWithBalances(userId)).find((a) => a.id === account.id)!;
    res.json({ account: updated });
  }),
);

async function loadAccountsWithBalances(userId: number) {
  const { accounts, balances } = await loadLedger(userId);
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
