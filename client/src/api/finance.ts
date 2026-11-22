import { api } from "./client.js";

// Track B API calls and response shapes — docs/system-sds.md §5.3. All amounts are integer satang.

export type AccountType = "CASH" | "LOAN_TAKEN" | "LOAN_GIVEN" | "INCOME" | "EXPENSE";
export type TransactionKind = "PAYMENT" | "RECEIVE";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  subtype: "BANK" | "WALLET" | "CREDIT_CARD" | null;
  openingBalance: number;
  openingDate: string | null;
  balance: number;
  // F-06: an archived account keeps its history but takes no new transactions. Absent = active.
  archived?: boolean;
  // F-06 v0.4: the account is the source or a line of a transaction, so it cannot be deleted or change type.
  inUse?: boolean;
}

export type AccountSubtype = NonNullable<Account["subtype"]>;

export interface AccountInput {
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
}

export interface Transaction {
  id: number;
  kind: TransactionKind;
  date: string;
  totalAmount: number;
  note: string | null;
  isFavorite: boolean;
  source: { id: number; name: string };
  lines: { accountId: number; name: string; amount: number }[];
}

export interface NewTransaction {
  kind: TransactionKind;
  sourceAccountId: number;
  date: string;
  totalAmount: number;
  note: string | null;
  lines: { accountId: number; amount: number }[];
}

interface SummaryEntry {
  accountId: number;
  name: string;
}

export interface Summary {
  cash: (SummaryEntry & { balance: number })[];
  loansTaken: (SummaryEntry & { outstanding: number })[];
  loansGiven: (SummaryEntry & { outstanding: number })[];
  totals: { income: number; expense: number };
  income: (SummaryEntry & { total: number })[];
  expense: (SummaryEntry & { total: number })[];
}

// BR-09 / BR-10: which accounts each form allows (mirrors server/src/services/ledger.ts).
export const SOURCE_TYPES: Record<TransactionKind, AccountType[]> = {
  PAYMENT: ["CASH", "LOAN_TAKEN"],
  RECEIVE: ["CASH"],
};
export const LINE_TYPES: Record<TransactionKind, AccountType[]> = {
  PAYMENT: ["EXPENSE", "LOAN_TAKEN", "LOAN_GIVEN", "CASH"],
  RECEIVE: ["INCOME", "LOAN_GIVEN", "LOAN_TAKEN", "CASH"],
};
// BR-12.
export const OPENING_BALANCE_TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN"];

// F-06 R4: the subtypes each type may have (mirrors server/src/services/accounts.ts).
export const ALLOWED_SUBTYPES: Record<AccountType, AccountSubtype[]> = {
  CASH: ["BANK", "WALLET"],
  LOAN_TAKEN: ["CREDIT_CARD"],
  LOAN_GIVEN: [],
  INCOME: [],
  EXPENSE: [],
};

export async function getAccounts(): Promise<Account[]> {
  return (await api<{ accounts: Account[] }>("/api/accounts")).accounts;
}

export async function setOpeningBalance(
  id: number,
  openingBalance: number,
  openingDate: string,
): Promise<Account> {
  const res = await api<{ account: Account }>(`/api/accounts/${id}/opening-balance`, {
    method: "PUT",
    body: JSON.stringify({ openingBalance, openingDate }),
  });
  return res.account;
}

export function getSummary(): Promise<Summary> {
  return api<Summary>("/api/summary");
}

export async function getTransactions(): Promise<Transaction[]> {
  return (await api<{ transactions: Transaction[] }>("/api/transactions")).transactions;
}

export async function getTransaction(id: string): Promise<Transaction> {
  return (await api<{ transaction: Transaction }>(`/api/transactions/${encodeURIComponent(id)}`)).transaction;
}

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  const res = await api<{ transaction: Transaction }>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.transaction;
}

// F-06 Custom account & category management — docs/sprints/sprint-2/F-06-account-management.md §3.
export async function createAccount(input: AccountInput): Promise<Account> {
  const res = await api<{ account: Account }>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.account;
}

export async function updateAccount(id: number, changes: Partial<AccountInput>): Promise<Account> {
  const res = await api<{ account: Account }>(`/api/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
  return res.account;
}

export async function setArchived(id: number, archived: boolean): Promise<Account> {
  const res = await api<{ account: Account }>(`/api/accounts/${id}/archive`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
  return res.account;
}

export async function deleteAccount(id: number): Promise<void> {
  await api<void>(`/api/accounts/${id}`, { method: "DELETE" });
}
