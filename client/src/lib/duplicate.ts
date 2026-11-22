import type { Transaction, TransactionKind } from "../api/finance.js";

// F-10 §2.1 Duplicate draft — docs/sprints/sprint-2/F-10-favorites-duplicate.md.
// Strips `id` and `isFavorite` and replaces `date` with today so saving creates a fresh transaction.
export interface DuplicateDraft {
  fromId: number;
  kind: TransactionKind;
  sourceAccountId: number;
  date: string;
  totalAmount: number;
  note: string;
  lines: { accountId: number; amount: number }[];
}

export function toDuplicateDraft(transaction: Transaction, today: string): DuplicateDraft {
  return {
    fromId: transaction.id,
    kind: transaction.kind,
    sourceAccountId: transaction.source.id,
    date: today,
    totalAmount: transaction.totalAmount,
    note: transaction.note ?? "",
    lines: transaction.lines.map((l) => ({ accountId: l.accountId, amount: l.amount })),
  };
}
