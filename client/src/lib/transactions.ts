import type { AccountType, Transaction } from "../api/finance.js";

// F-07 §2 "Transfer, as displayed" — docs/sprints/sprint-2/F-07-transfers.md. A transfer is not stored as
// such: it is any transaction whose source and every line are CASH accounts. Account types come from
// GET /api/accounts; an account whose type is unknown makes the transaction "not a transfer".
export type AccountTypes = Map<number, { type: AccountType }>;

export function isTransfer(t: Transaction, accountsById: AccountTypes): boolean {
  const isCash = (id: number) => accountsById.get(id)?.type === "CASH";
  return t.lines.length > 0 && isCash(t.source.id) && t.lines.every((l) => isCash(l.accountId));
}

// The arrow follows the money: a PAYMENT moves it from the source to the lines, a RECEIVE from the lines
// into the source.
export function transferLabel(t: Transaction, accountsById: AccountTypes): string | null {
  if (!isTransfer(t, accountsById)) return null;
  const lineNames = t.lines.map((l) => l.name).join(", ");
  return t.kind === "PAYMENT"
    ? `Transfer: ${t.source.name} → ${lineNames}`
    : `Transfer: ${lineNames} → ${t.source.name}`;
}

export function accountTypesOf(accounts: { id: number; type: AccountType }[] | undefined): AccountTypes {
  return new Map((accounts ?? []).map((a) => [a.id, { type: a.type }]));
}
