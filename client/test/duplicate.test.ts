import { describe, expect, it } from "vitest";
import type { Transaction } from "../src/api/finance.js";
import { toDuplicateDraft } from "../src/lib/duplicate.js";

// F-10 §1, §2.1 & §7 T-FAV-UNIT-01 — docs/sprints/sprint-2/F-10-favorites-duplicate.md.
describe("toDuplicateDraft (T-FAV-UNIT-01)", () => {
  it("copies kind, source, lines, amounts and note dated today without id or isFavorite", () => {
    const demo2: Transaction = {
      id: 13,
      kind: "PAYMENT",
      date: "2026-11-03",
      totalAmount: 150_000,
      note: "Dinner and groceries",
      isFavorite: true,
      source: { id: 2, name: "Credit Card" },
      lines: [
        { accountId: 5, name: "Dining", amount: 90_000 },
        { accountId: 6, name: "Groceries", amount: 60_000 },
      ],
    };

    const draft = toDuplicateDraft(demo2, "2026-11-22");
    expect(draft).toEqual({
      fromId: 13,
      kind: "PAYMENT",
      sourceAccountId: 2,
      date: "2026-11-22",
      totalAmount: 150_000,
      note: "Dinner and groceries",
      lines: [
        { accountId: 5, amount: 90_000 },
        { accountId: 6, amount: 60_000 },
      ],
    });
    expect("id" in draft).toBe(false);
    expect("isFavorite" in draft).toBe(false);
  });

  it("normalizes null note to empty string", () => {
    const tx: Transaction = {
      id: 12,
      kind: "RECEIVE",
      date: "2026-11-02",
      totalAmount: 3_000_000,
      note: null,
      isFavorite: false,
      source: { id: 1, name: "Bank" },
      lines: [{ accountId: 3, name: "Salary", amount: 3_000_000 }],
    };
    expect(toDuplicateDraft(tx, "2026-11-22").note).toBe("");
  });
});
