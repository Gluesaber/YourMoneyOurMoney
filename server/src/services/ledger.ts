import type { AccountType, TransactionKind } from "@prisma/client";

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
