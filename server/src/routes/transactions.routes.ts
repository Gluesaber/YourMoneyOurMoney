import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { MAX_INT, calendarDate, fromDateOnly, parseId, toDateOnly } from "../lib/validation.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import { validateTransaction } from "../services/ledger.js";

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

    // Steps 3–6.
    validateTransaction(body, new Map(accounts.map((a) => [a.id, a])));

    // Step 7 — BR-13: the transaction and its lines are saved together or not at all. Lines are created
    // separately because the composite (id, userId) foreign keys do not allow userId in a nested create.
    const created = await prisma.$transaction(async (tx) => {
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

// FR-HST-01: the user's transactions, newest date first, then highest id first. No pagination in Sprint 1.
transactionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await getPrisma().transaction.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: transactionInclude,
    });
    res.json({ transactions: rows.map(toTransactionResponse) });
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
