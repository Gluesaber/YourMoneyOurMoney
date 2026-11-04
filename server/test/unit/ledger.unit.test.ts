import { describe, expect, it } from "vitest";
import type { AccountType, TransactionKind } from "@prisma/client";
import { computeBalances, type LedgerAccount, type LedgerTransaction } from "../../src/services/ledger.js";

// computeBalances — docs/system-sds.md §4.1, docs/sprints/sprint-1/F-05-summary-history.md §2.1.
// Added in S1-11 because GET /api/accounts returns balances; S1-13 adds the remaining F-05 unit tests.

function account(id: number, type: AccountType, openingBalance = 0): LedgerAccount {
  return { id, type, openingBalance };
}

function tx(kind: TransactionKind, sourceAccountId: number, lines: [number, number][]): LedgerTransaction {
  return {
    kind,
    sourceAccountId,
    totalAmount: lines.reduce((sum, [, amount]) => sum + amount, 0),
    lines: lines.map(([accountId, amount]) => ({ accountId, amount })),
  };
}

describe("computeBalances", () => {
  it("T-SUM-UNIT-01: with no transactions every balance equals its opening balance", () => {
    const balances = computeBalances(
      [account(1, "CASH", 1_000_000), account(2, "LOAN_TAKEN", 250), account(3, "EXPENSE")],
      [],
    );
    expect([...balances]).toEqual([
      [1, 1_000_000],
      [2, 250],
      [3, 0],
    ]);
  });

  // One transaction per cell of system-sds.md §4.1. Source and line amounts are both 100.
  // [form, source type, line type, expected change on source, expected change on line account]
  it.each([
    ["PAYMENT", "CASH", "EXPENSE", -100, +100],
    ["PAYMENT", "CASH", "LOAN_TAKEN", -100, -100], // repay a loan / card
    ["PAYMENT", "CASH", "LOAN_GIVEN", -100, +100], // lend
    ["PAYMENT", "CASH", "CASH", -100, +100], // transfer out of source, into line
    ["PAYMENT", "LOAN_TAKEN", "EXPENSE", +100, +100], // card purchase
    ["PAYMENT", "LOAN_TAKEN", "LOAN_TAKEN", +100, -100], // pay one loan with another
    ["PAYMENT", "LOAN_TAKEN", "LOAN_GIVEN", +100, +100],
    ["PAYMENT", "LOAN_TAKEN", "CASH", +100, +100], // cash advance
    ["RECEIVE", "CASH", "INCOME", +100, +100],
    ["RECEIVE", "CASH", "LOAN_GIVEN", +100, -100], // someone repays the user
    ["RECEIVE", "CASH", "LOAN_TAKEN", +100, +100], // new borrowing
    ["RECEIVE", "CASH", "CASH", +100, -100], // transfer into source, out of line
  ] as const)(
    "T-SUM-UNIT-03: %s from %s with a %s line moves source %i and line %i",
    (kind, sourceType, lineType, sourceChange, lineChange) => {
      const accounts = [
        account(1, sourceType, 1_000),
        account(2, lineType, lineType === "INCOME" || lineType === "EXPENSE" ? 0 : 1_000),
      ];
      const before = computeBalances(accounts, []);
      const after = computeBalances(accounts, [tx(kind, 1, [[2, 100]])]);
      expect(after.get(1)! - before.get(1)!).toBe(sourceChange);
      expect(after.get(2)! - before.get(2)!).toBe(lineChange);
    },
  );

  it("adds up several lines and several transactions", () => {
    const accounts = [
      account(1, "CASH", 1_000_000),
      account(2, "LOAN_TAKEN"),
      account(3, "INCOME"),
      account(4, "EXPENSE"),
      account(5, "EXPENSE"),
    ];
    const balances = computeBalances(accounts, [
      tx("RECEIVE", 1, [[3, 3_000_000]]),
      tx("PAYMENT", 2, [
        [4, 90_000],
        [5, 60_000],
      ]),
      tx("PAYMENT", 1, [[2, 150_000]]),
    ]);
    // The Sprint 1 demo journey (system-sds.md §4.3).
    expect(Object.fromEntries(balances)).toEqual({ 1: 3_850_000, 2: 0, 3: 3_000_000, 4: 90_000, 5: 60_000 });
  });

  it("throws when a transaction refers to an account that is not in the list", () => {
    expect(() => computeBalances([account(1, "CASH")], [tx("PAYMENT", 1, [[99, 100]])])).toThrow(/99/);
  });
});
