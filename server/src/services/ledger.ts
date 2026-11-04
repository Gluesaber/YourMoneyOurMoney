import type { AccountType, TransactionKind } from "@prisma/client";
import { AppError, ErrorCode } from "../lib/errors.js";

// Track B business logic (docs/system-sds.md §4, docs/sprints/sprint-1/F-04, F-05). Plain functions only:
// no Prisma, no Express, so they can be unit-tested without a database.

export interface LedgerAccount {
  id: number;
  type: AccountType;
  openingBalance: number;
}

export interface LedgerTransaction {
  kind: TransactionKind;
  sourceAccountId: number;
  totalAmount: number;
  lines: { accountId: number; amount: number }[];
}

// system-sds.md §4.1: the sign each account moves by. Combinations BR-09 / BR-10 forbid are absent,
// so a stored transaction that breaks them is reported instead of silently counted.
const SOURCE_SIGN: Record<TransactionKind, Partial<Record<AccountType, 1 | -1>>> = {
  PAYMENT: { CASH: -1, LOAN_TAKEN: 1 },
  RECEIVE: { CASH: 1 },
};

const LINE_SIGN: Record<TransactionKind, Partial<Record<AccountType, 1 | -1>>> = {
  PAYMENT: { EXPENSE: 1, LOAN_TAKEN: -1, LOAN_GIVEN: 1, CASH: 1 },
  RECEIVE: { INCOME: 1, LOAN_GIVEN: -1, LOAN_TAKEN: 1, CASH: -1 },
};

// balance = openingBalance + Σ source effects + Σ line effects, in satang. Returns one entry per account,
// in the order the accounts were given.
export function computeBalances(
  accounts: LedgerAccount[],
  transactions: LedgerTransaction[],
): Map<number, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  const typeOf = new Map(accounts.map((a) => [a.id, a.type]));

  const apply = (accountId: number, amount: number, signs: Partial<Record<AccountType, 1 | -1>>) => {
    const type = typeOf.get(accountId);
    if (type === undefined)
      throw new Error(`computeBalances: account ${accountId} is not in the account list`);
    const sign = signs[type];
    if (sign === undefined)
      throw new Error(`computeBalances: account ${accountId} (${type}) is not allowed here`);
    balances.set(accountId, balances.get(accountId)! + sign * amount);
  };

  for (const t of transactions) {
    apply(t.sourceAccountId, t.totalAmount, SOURCE_SIGN[t.kind]);
    for (const line of t.lines) apply(line.accountId, line.amount, LINE_SIGN[t.kind]);
  }
  return balances;
}

export type TransactionInput = LedgerTransaction;

// F-04 §2 steps 3–6, in that order; the first broken rule is thrown and nothing else is checked.
// `accountsById` holds every account the input refers to, already confirmed to be the user's (step 2).
// The allowed types are the keys of the sign tables above, so BR-09 / BR-10 and the balance rules can
// never disagree.
export function validateTransaction(
  input: TransactionInput,
  accountsById: Map<number, { id: number; type: AccountType }>,
): void {
  const typeOf = (id: number) => {
    const account = accountsById.get(id);
    if (!account) throw new Error(`validateTransaction: account ${id} was not loaded`);
    return account.type;
  };

  // Step 3 — BR-09.
  const sourceType = typeOf(input.sourceAccountId);
  if (SOURCE_SIGN[input.kind][sourceType] === undefined) {
    throw new AppError(
      400,
      ErrorCode.INVALID_ACCOUNT_TYPE,
      input.kind === "PAYMENT"
        ? "A payment must come from a cash or loan-taken account."
        : "Money can only be received into a cash account.",
      { field: "sourceAccountId", type: sourceType },
    );
  }

  // Step 4 — BR-11.
  const sourceAsLine = input.lines.findIndex((l) => l.accountId === input.sourceAccountId);
  if (sourceAsLine !== -1) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      "The source account cannot also be an allocation line.",
      {
        field: "lines",
        lineIndex: sourceAsLine,
      },
    );
  }

  // Step 5 — BR-10.
  for (const [lineIndex, line] of input.lines.entries()) {
    const type = typeOf(line.accountId);
    if (LINE_SIGN[input.kind][type] === undefined) {
      throw new AppError(
        400,
        ErrorCode.INVALID_ACCOUNT_TYPE,
        `Line ${lineIndex + 1} uses a ${type.toLowerCase().replace("_", " ")} account, which is not allowed in a ${input.kind.toLowerCase()}.`,
        { field: "lines", lineIndex, type },
      );
    }
  }

  // Step 6 — BR-01.
  const linesTotal = input.lines.reduce((sum, l) => sum + l.amount, 0);
  if (linesTotal !== input.totalAmount) {
    throw new AppError(400, ErrorCode.ALLOCATION_MISMATCH, "The allocation lines must add up to the total.", {
      totalAmount: input.totalAmount,
      linesTotal,
      difference: linesTotal - input.totalAmount,
    });
  }
}

export interface SummaryAccount extends LedgerAccount {
  name: string;
}

// GET /api/summary body (system-sds.md §5.3, F-05 §3) from accounts and their computed balances.
// Income and expense totals are the INCOME / EXPENSE account balances: those accounts only ever move by
// RECEIVE lines (income) and PAYMENT lines (expense), so transfers, borrowing, lending, repayments and
// opening balances can never reach them (BR-08, BR-12). Every list is sorted by name and keeps zero values.
export function summarize(accounts: SummaryAccount[], balances: Map<number, number>) {
  const ofType = (type: AccountType) =>
    accounts
      .filter((a) => a.type === type)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ accountId: a.id, name: a.name, value: balances.get(a.id) ?? 0 }));
  const sum = (list: { value: number }[]) => list.reduce((s, e) => s + e.value, 0);

  const income = ofType("INCOME");
  const expense = ofType("EXPENSE");
  return {
    cash: ofType("CASH").map(({ value, ...e }) => ({ ...e, balance: value })),
    loansTaken: ofType("LOAN_TAKEN").map(({ value, ...e }) => ({ ...e, outstanding: value })),
    loansGiven: ofType("LOAN_GIVEN").map(({ value, ...e }) => ({ ...e, outstanding: value })),
    totals: { income: sum(income), expense: sum(expense) },
    income: income.map(({ value, ...e }) => ({ ...e, total: value })),
    expense: expense.map(({ value, ...e }) => ({ ...e, total: value })),
  };
}
