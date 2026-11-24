import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { MAX_INT, calendarDate, fromDateOnly, parseId, toDateOnly } from "../lib/validation.js";
import { MAX_TRANSACTION_ROWS, parseTransactionQuery, toOrderBy, toWhere } from "../lib/transactionQuery.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import { cashDecreases, checkCashFunds, validateTransaction } from "../services/ledger.js";
import { loadLedger } from "../services/userLedger.js";

// F-04 Record a transaction (POST /) — docs/sprints/sprint-1/F-04-transactions.md.
// F-05 Transaction history (GET /, GET /:id) — docs/sprints/sprint-1/F-05-summary-history.md §3.
export const transactionsRouter = Router();

transactionsRouter.use(requireUser, requireRole("USER"));

const satang = z.number().int().min(1).max(MAX_INT);
const accountId = z.number().int().min(1).max(MAX_INT);

// Step 1 of F-04 §2.
const createBody = z.object({
  kind: z.enum(["PAYMENT", "RECEIVE"]),
  sourceAccountId: accountId,
  date: calendarDate,
  totalAmount: satang,
  // Trimmed before the length check, so surrounding spaces never count towards the 200 characters.
  note: z
    .string()
    .trim()
    .max(200, "Use 200 characters or fewer.")
    .nullish()
    .transform((s) => s || null),
  lines: z
    .array(z.object({ accountId, amount: satang }))
    .min(1)
    .max(20),
});

transactionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = createBody.parse(req.body);
    const prisma = getPrisma();

    // Step 2 — BR-04: every referenced account must exist and be the user's. One message for both
    // cases, so another user's account ids cannot be discovered.
    const ids = [...new Set([body.sourceAccountId, ...body.lines.map((l) => l.accountId)])];
    const accounts = await prisma.account.findMany({ where: { userId, id: { in: ids } } });
    if (accounts.length !== ids.length) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "Account not found.");
    }
    // F-06 R7 (BR-16): an archived account takes no new transactions. Runs after ownership, before
    // the type checks, so another user's archived account is still a plain 404.
    assertNotArchived(body, new Map(accounts.map((a) => [a.id, a])));

    // Steps 3–6.
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    validateTransaction(body, accountsById);

    // Steps 7–8 run in one database transaction, so a rejected transaction changes nothing (BR-13).
    const created = await prisma.$transaction(async (tx) => {
      // Step 7 — BR-14 (Lab 7 L7-01): no CASH account this transaction decreases may end below 0. Lock those
      // account rows first, in ascending id order so two requests can never lock the same accounts in opposite
      // order (deadlock), then read the balances inside this transaction: a concurrent payment from the same
      // account waits here and then sees this one's effect.
      const decreased = [...cashDecreases(body, accountsById).keys()].sort((a, b) => a - b);
      if (decreased.length > 0) {
        await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" IN (${Prisma.join(decreased)}) ORDER BY "id" FOR UPDATE`;
        const { balances } = await loadLedger(userId, tx);
        checkCashFunds(body, accountsById, balances);
      }

      // Step 8 — save the transaction and its lines. Lines are created separately because the composite
      // (id, userId) foreign keys do not allow userId in a nested create.
      const transaction = await tx.transaction.create({
        data: {
          userId,
          kind: body.kind,
          sourceAccountId: body.sourceAccountId,
          date: fromDateOnly(body.date),
          totalAmount: body.totalAmount,
          note: body.note,
        },
      });
      await tx.transactionLine.createMany({
        data: body.lines.map((l) => ({ transactionId: transaction.id, userId, ...l })),
      });
      return transaction.id;
    });

    res.status(201).json({ transaction: await loadTransaction(userId, created) });
  }),
);

function assertNotArchived(
  body: { sourceAccountId: number; lines: { accountId: number }[] },
  accountsById: Map<number, { id: number; name: string; archivedAt: Date | null }>,
) {
  const archived = (id: number) => accountsById.get(id)!.archivedAt !== null;
  const message = (id: number) =>
    `${accountsById.get(id)!.name} is archived. Unarchive it or choose another account.`;
  if (archived(body.sourceAccountId)) {
    throw new AppError(400, ErrorCode.ACCOUNT_ARCHIVED, message(body.sourceAccountId), {
      field: "sourceAccountId",
      accountId: body.sourceAccountId,
    });
  }
  const lineIndex = body.lines.findIndex((l) => archived(l.accountId));
  if (lineIndex !== -1) {
    const accountId = body.lines[lineIndex].accountId;
    throw new AppError(400, ErrorCode.ACCOUNT_ARCHIVED, message(accountId), {
      field: "lines",
      lineIndex,
      accountId,
    });
  }
}

// FR-HST-01 / FR-HST-03: filtered & sorted user transactions, capped at MAX_TRANSACTION_ROWS (F-09 R6).
transactionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parseTransactionQuery(req.query);
    const rows = await getPrisma().transaction.findMany({
      where: toWhere(query, req.user!.id),
      orderBy: toOrderBy(query.sort),
      take: MAX_TRANSACTION_ROWS + 1,
      include: transactionInclude,
    });
    const truncated = rows.length > MAX_TRANSACTION_ROWS;
    const shown = truncated ? rows.slice(0, MAX_TRANSACTION_ROWS) : rows;
    res.json({ transactions: shown.map(toTransactionResponse), truncated });
  }),
);

// FR-HST-02: one transaction. Another user's, a missing and a non-numeric id are the same 404 (BR-04).
transactionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(404, ErrorCode.NOT_FOUND, "Transaction not found.");
    res.json({ transaction: await loadTransaction(req.user!.id, id) });
  }),
);

// F-10 R1..R5: star or unstar a transaction owned by the current user; idempotent and never alters balances.
const favoriteBody = z.object({ isFavorite: z.boolean() }).strict();

transactionsRouter.patch(
  "/:id/favorite",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(404, ErrorCode.NOT_FOUND, "Transaction not found.");
    const body = favoriteBody.parse(req.body);
    const updated = await getPrisma().transaction.updateMany({
      where: { id, userId: req.user!.id },
      data: { isFavorite: body.isFavorite },
    });
    if (updated.count === 0) throw new AppError(404, ErrorCode.NOT_FOUND, "Transaction not found.");
    res.json({ transaction: await loadTransaction(req.user!.id, id) });
  }),
);

// Shape shared by POST, GET / and GET /:id (system-sds.md §5.3). Lines keep their entry order.
const transactionInclude = {
  sourceAccount: { select: { id: true, name: true } },
  lines: {
    orderBy: { id: "asc" },
    select: { accountId: true, amount: true, account: { select: { name: true } } },
  },
} as const;

type TransactionRow = NonNullable<Awaited<ReturnType<typeof findTransaction>>>;

function findTransaction(userId: number, id: number) {
  return getPrisma().transaction.findFirst({ where: { id, userId }, include: transactionInclude });
}

async function loadTransaction(userId: number, id: number) {
  const row = await findTransaction(userId, id);
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, "Transaction not found.");
  return toTransactionResponse(row);
}

export function toTransactionResponse(t: TransactionRow) {
  return {
    id: t.id,
    kind: t.kind,
    date: toDateOnly(t.date),
    totalAmount: t.totalAmount,
    note: t.note,
    isFavorite: t.isFavorite,
    source: { id: t.sourceAccount.id, name: t.sourceAccount.name },
    lines: t.lines.map((l) => ({ accountId: l.accountId, name: l.account.name, amount: l.amount })),
  };
}
