import { Router } from "express";
import { z } from "zod";
import { Prisma, type Account, type AccountSubtype, type AccountType } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { assertOwned } from "../lib/ownership.js";
import { MAX_INT, calendarDate, fromDateOnly, parseId, toDateOnly } from "../lib/validation.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import {
  BALANCE_TYPES,
  MAX_ACCOUNTS_PER_USER,
  OPENING_BALANCE_TYPES,
  validateAccountShape,
} from "../services/accounts.js";
import { loadLedger } from "../services/userLedger.js";

// F-03 Accounts and opening balances — docs/sprints/sprint-1/F-03-accounts.md.
// F-06 Custom account & category management — docs/sprints/sprint-2/F-06-account-management.md.
export const accountsRouter = Router();

accountsRouter.use(requireUser, requireRole("USER"));

// Contract §3: by type in this order, then by name A→Z.
const TYPE_ORDER: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"];

const accountType = z.enum(["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"]);
const accountSubtype = z.enum(["BANK", "WALLET", "CREDIT_CARD"]).nullable();
// F-06 R2: trimmed before the length check, so surrounding spaces never count.
const accountName = z.string().trim().min(1, "Enter a name.").max(50, "Use 50 characters or fewer.");

const openingBalanceBody = z.object({
  openingBalance: z.number().int().min(0).max(MAX_INT),
  openingDate: calendarDate,
});

const createBody = z.object({ name: accountName, type: accountType, subtype: accountSubtype.optional() });

const updateBody = z
  .object({ name: accountName.optional(), type: accountType.optional(), subtype: accountSubtype.optional() })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Send at least one of name, type, subtype.");

const archiveBody = z.object({ archived: z.boolean() });

accountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const accounts = await loadAccountsWithBalances(userId);
    res.json({ accounts });
  }),
);

// F-06: create an account.
accountsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = createBody.parse(req.body);
    const subtype = body.subtype ?? null;
    validateAccountShape(body.type, subtype); // R4

    const prisma = getPrisma();
    if ((await prisma.account.count({ where: { userId } })) >= MAX_ACCOUNTS_PER_USER) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `You can have at most ${MAX_ACCOUNTS_PER_USER} accounts, archived ones included.`,
        { field: "name", limit: MAX_ACCOUNTS_PER_USER },
      );
    }
    await assertNameFree(userId, body.name); // R3

    const created = await saveName(() =>
      prisma.account.create({ data: { userId, name: body.name, type: body.type, subtype } }),
    );
    res.status(201).json({ account: await loadAccount(userId, created.id) });
  }),
);

// F-06: rename, and change type/subtype while the account is unused.
accountsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = parseId(req.params.id);
    if (id === null) throw notFound();
    const body = updateBody.parse(req.body);
    // R4 that does not depend on the stored account: a type sent without a subtype resets it to null.
    if (body.type !== undefined) validateAccountShape(body.type, body.subtype ?? null);

    const prisma = getPrisma();
    const account = assertOwned(await prisma.account.findUnique({ where: { id } }), userId);

    if (body.name !== undefined) await assertNameFree(userId, body.name, account.id); // R3

    const type = body.type ?? account.type;
    const subtype: AccountSubtype | null =
      body.subtype !== undefined ? body.subtype : body.type !== undefined ? null : account.subtype;
    if (body.type === undefined) validateAccountShape(type, subtype); // R4 for a subtype-only change

    if (type !== account.type || subtype !== account.subtype) {
      if (await isUsed(account.id)) {
        throw new AppError(
          400,
          ErrorCode.CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS,
          "The type of an account that has transactions cannot change.",
          { field: "type" },
        ); // R5
      }
      if (!OPENING_BALANCE_TYPES.includes(type) && account.openingBalance !== 0) {
        throw new AppError(
          400,
          ErrorCode.INVALID_ACCOUNT_TYPE,
          "Set the opening balance to 0 before making this an income or expense account.",
          { field: "type", type },
        ); // R6, BR-12
      }
    }

    await saveName(() =>
      prisma.account.update({ where: { id: account.id }, data: { name: body.name, type, subtype } }),
    );
    res.json({ account: await loadAccount(userId, account.id) });
  }),
);

// F-06: archive (no new transactions, history kept) or unarchive.
accountsRouter.patch(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = parseId(req.params.id);
    if (id === null) throw notFound();
    const body = archiveBody.parse(req.body);

    const prisma = getPrisma();
    const account = assertOwned(await prisma.account.findUnique({ where: { id } }), userId);

    if (body.archived && BALANCE_TYPES.includes(account.type)) {
      const { balance } = await loadAccount(userId, account.id);
      if (balance !== 0) {
        throw new AppError(
          400,
          ErrorCode.ACCOUNT_NOT_EMPTY,
          "Only an account with a balance of 0 can be archived.",
          { balance },
        ); // R8
      }
    }

    // Archiving twice keeps the first archive time.
    const archivedAt = body.archived ? (account.archivedAt ?? new Date()) : null;
    await prisma.account.update({ where: { id: account.id }, data: { archivedAt } });
    res.json({ account: await loadAccount(userId, account.id) });
  }),
);

// F-06: delete an account no transaction has ever used.
accountsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = parseId(req.params.id);
    if (id === null) throw notFound();

    const prisma = getPrisma();
    const account = assertOwned(await prisma.account.findUnique({ where: { id } }), userId);
    if (await isUsed(account.id)) throw inUse(); // R9

    try {
      await prisma.account.delete({ where: { id: account.id } });
    } catch (err) {
      // A transaction saved between the check and the delete: ON DELETE RESTRICT refuses it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") throw inUse();
      throw err;
    }
    res.status(204).end();
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
    // F-06 R7: an archived account never gains a balance.
    if (account.archivedAt !== null) {
      throw new AppError(400, ErrorCode.ACCOUNT_ARCHIVED, "Unarchive this account first.", {
        field: "id",
        accountId: account.id,
      });
    }

    await prisma.account.update({
      where: { id: account.id },
      data: {
        openingBalance: body.openingBalance,
        openingDate: fromDateOnly(body.openingDate),
      },
    });

    res.json({ account: await loadAccount(userId, account.id) });
  }),
);

function notFound() {
  return new AppError(404, ErrorCode.NOT_FOUND, "Not found.");
}

function inUse() {
  return new AppError(
    409,
    ErrorCode.ACCOUNT_IN_USE,
    "This account has transactions, so it cannot be deleted. Archive it instead.",
  );
}

// F-06 R3: unique per user ignoring case (names are already trimmed by the schema).
async function assertNameFree(userId: number, name: string, exceptId?: number) {
  const clash = await getPrisma().account.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
      NOT: exceptId ? { id: exceptId } : undefined,
    },
    select: { id: true },
  });
  if (clash) throw nameTaken(name);
}

function nameTaken(name: string) {
  return new AppError(409, ErrorCode.ACCOUNT_NAME_TAKEN, `You already have an account named ${name}.`, {
    field: "name",
  });
}

// Two requests racing past assertNameFree: the unique indexes still refuse the second one.
async function saveName<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, ErrorCode.ACCOUNT_NAME_TAKEN, "You already have an account with that name.", {
        field: "name",
      });
    }
    // The case-insensitive index is not known to Prisma, so its violation arrives as a raw database error.
    if (
      err instanceof Prisma.PrismaClientUnknownRequestError &&
      /Account_userId_lower_name_key/.test(err.message)
    ) {
      throw new AppError(409, ErrorCode.ACCOUNT_NAME_TAKEN, "You already have an account with that name.", {
        field: "name",
      });
    }
    throw err;
  }
}

// Used = the source or a line of any transaction (F-06 R5, R9).
async function isUsed(accountId: number): Promise<boolean> {
  const prisma = getPrisma();
  const [asSource, asLine] = await Promise.all([
    prisma.transaction.count({ where: { sourceAccountId: accountId } }),
    prisma.transactionLine.count({ where: { accountId } }),
  ]);
  return asSource + asLine > 0;
}

async function loadAccount(userId: number, id: number) {
  return (await loadAccountsWithBalances(userId)).find((a) => a.id === id)!;
}

async function loadAccountsWithBalances(userId: number) {
  const [{ accounts, balances }, used] = await Promise.all([loadLedger(userId), usedAccountIds(userId)]);
  return accounts
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name))
    .map((a) => toAccountResponse(a, balances.get(a.id)!, used.has(a.id)));
}

// F-06 v0.4 §3 `inUse`: every account of the user that is the source or a line of any transaction.
async function usedAccountIds(userId: number): Promise<Set<number>> {
  const prisma = getPrisma();
  const [sources, lines] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      select: { sourceAccountId: true },
      distinct: ["sourceAccountId"],
    }),
    prisma.transactionLine.findMany({
      where: { userId },
      select: { accountId: true },
      distinct: ["accountId"],
    }),
  ]);
  return new Set([...sources.map((t) => t.sourceAccountId), ...lines.map((l) => l.accountId)]);
}

function toAccountResponse(a: Account, balance: number, inUse: boolean) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    subtype: a.subtype,
    openingBalance: a.openingBalance,
    openingDate: a.openingDate ? toDateOnly(a.openingDate) : null,
    balance,
    archived: a.archivedAt !== null,
    inUse,
  };
}
