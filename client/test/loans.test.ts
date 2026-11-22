import { describe, expect, it } from "vitest";
import { loanActionToTransaction, type LoanAction } from "../src/lib/loans.js";

// F-08 §1, §2.1 & §7 T-DEBT-UNIT-01 — docs/sprints/sprint-2/F-08-loans.md.
describe("loanActionToTransaction (T-DEBT-UNIT-01)", () => {
  it.each<[LoanAction, number, "PAYMENT" | "RECEIVE", string, string | null]>([
    ["lend", 10, "PAYMENT", "  Lunch loan  ", "Lunch loan"],
    ["repaid", 10, "RECEIVE", "", null],
    ["borrow", 11, "RECEIVE", "   ", null],
    ["repay", 11, "PAYMENT", "Pay back Mom", "Pay back Mom"],
  ])(
    "%s maps to %s with loan line and normalized note",
    (action, loanAccountId, expectedKind, note, expectedNote) => {
      expect(
        loanActionToTransaction(action, {
          cashAccountId: 1,
          loanAccountId,
          amount: 500_000,
          date: "2026-11-22",
          note,
        }),
      ).toEqual({
        kind: expectedKind,
        sourceAccountId: 1,
        date: "2026-11-22",
        totalAmount: 500_000,
        note: expectedNote,
        lines: [{ accountId: loanAccountId, amount: 500_000 }],
      });
    },
  );
});
