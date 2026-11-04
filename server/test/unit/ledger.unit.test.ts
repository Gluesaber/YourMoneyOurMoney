import { describe, expect, it } from "vitest";
import type { AccountType, TransactionKind } from "@prisma/client";
import {
  computeBalances,
  summarize,
  type LedgerAccount,
  type LedgerTransaction,
} from "../../src/services/ledger.js";

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

  it("T-SUM-UNIT-02: the demo journey gives the documented balances", () => {
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

// summarize — docs/sprints/sprint-1/F-05-summary-history.md §2 (R2, R3) and the GET /api/summary shape.
describe("summarize", () => {
  function named(id: number, name: string, type: AccountType, openingBalance = 0) {
    return { id, name, type, openingBalance };
  }

  it("T-SUM-UNIT-04: opening balances, a repayment, a Cash→Cash transfer and borrowing never count as income or expense", () => {
    const accounts = [
      named(1, "Bank", "CASH", 1_000_000),
      named(2, "Wallet", "CASH", 5_000),
      named(3, "Credit Card", "LOAN_TAKEN", 200_000),
      named(4, "Loan from Mom", "LOAN_TAKEN"),
      named(5, "Salary", "INCOME"),
      named(6, "Dining", "EXPENSE"),
    ];
    const transactions = [
      tx("PAYMENT", 1, [[3, 150_000]]), // repay card
      tx("PAYMENT", 1, [[2, 10_000]]), // Bank → Wallet
      tx("RECEIVE", 1, [[2, 2_000]]), // Wallet → Bank
      tx("RECEIVE", 1, [[4, 500_000]]), // borrow
    ];
    const summary = summarize(accounts, computeBalances(accounts, transactions));
    expect(summary.totals).toEqual({ income: 0, expense: 0 });
    expect(summary.income).toEqual([{ accountId: 5, name: "Salary", total: 0 }]);
    expect(summary.expense).toEqual([{ accountId: 6, name: "Dining", total: 0 }]);
  });

  it("groups accounts by type, sorts each list by name and includes zero values", () => {
    const accounts = [
      named(1, "Wallet", "CASH"),
      named(2, "Bank", "CASH", 1_000_000),
      named(3, "Credit Card", "LOAN_TAKEN"),
      named(4, "Loan to Ann", "LOAN_GIVEN", 30_000),
      named(5, "Salary", "INCOME"),
      named(6, "Interest", "INCOME"),
      named(7, "Groceries", "EXPENSE"),
      named(8, "Dining", "EXPENSE"),
    ];
    const summary = summarize(
      accounts,
      computeBalances(accounts, [
        tx("RECEIVE", 2, [[5, 3_000_000]]),
        tx("PAYMENT", 3, [
          [8, 90_000],
          [7, 60_000],
        ]),
      ]),
    );
    expect(summary).toEqual({
      cash: [
        { accountId: 2, name: "Bank", balance: 4_000_000 },
        { accountId: 1, name: "Wallet", balance: 0 },
      ],
      loansTaken: [{ accountId: 3, name: "Credit Card", outstanding: 150_000 }],
      loansGiven: [{ accountId: 4, name: "Loan to Ann", outstanding: 30_000 }],
      totals: { income: 3_000_000, expense: 150_000 },
      income: [
        { accountId: 6, name: "Interest", total: 0 },
        { accountId: 5, name: "Salary", total: 3_000_000 },
      ],
      expense: [
        { accountId: 8, name: "Dining", total: 90_000 },
        { accountId: 7, name: "Groceries", total: 60_000 },
      ],
    });
  });
});
