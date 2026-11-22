import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  MAX_TRANSACTION_ROWS,
  escapeLike,
  parseTransactionQuery,
  toOrderBy,
  toWhere,
  type TransactionSort,
} from "../../src/lib/transactionQuery.js";
import { fromDateOnly } from "../../src/lib/validation.js";

// F-09 §2, §2.1 & §7 T-HST-UNIT-01 — docs/sprints/sprint-2/F-09-search-filter.md.
describe("transactionQuery (T-HST-UNIT-01)", () => {
  it("exports the 500-row cap (R6)", () => {
    expect(MAX_TRANSACTION_ROWS).toBe(500);
  });

  it("escapeLike escapes backslashes, %, and _ so ILIKE matches literally (R4)", () => {
    expect(escapeLike("50%_\\off")).toBe("50\\%\\_\\\\off");
    expect(escapeLike("dinner")).toBe("dinner");
  });

  it("parseTransactionQuery defaults sort to date_desc, trims q, strips empty q, and ignores unknown params", () => {
    expect(parseTransactionQuery({})).toEqual({ sort: "date_desc" });
    expect(parseTransactionQuery({ q: "   ", foo: "ignored" })).toEqual({ sort: "date_desc" });

    expect(
      parseTransactionQuery({
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        accountId: "7",
        kind: "PAYMENT",
        q: "  dinner  ",
        sort: "amount_asc",
        favorite: "true",
      }),
    ).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      accountId: 7,
      kind: "PAYMENT",
      q: "dinner",
      sort: "amount_asc",
    });
  });

  it.each([
    ["reversed date range", { startDate: "2026-11-30", endDate: "2026-11-01" }],
    ["invalid calendar date", { startDate: "2026-02-30" }],
    ["date before 2000", { endDate: "1999-12-31" }],
    ["zero accountId", { accountId: "0" }],
    ["negative accountId", { accountId: "-5" }],
    ["non-numeric accountId", { accountId: "abc" }],
    ["accountId above MAX_INT", { accountId: "2147483648" }],
    ["unknown kind", { kind: "TRANSFER" }],
    ["unknown sort", { sort: "foo" }],
    ["q over 100 chars", { q: "a".repeat(101) }],
    ["duplicate array param", { kind: ["PAYMENT", "RECEIVE"] }],
  ])("parseTransactionQuery rejects %s with ZodError", (_label, raw) => {
    expect(() => parseTransactionQuery(raw)).toThrow(ZodError);
  });

  it("toWhere always scopes to userId and builds combined filters", () => {
    expect(toWhere({ sort: "date_desc" }, 42)).toEqual({ userId: 42 });

    expect(toWhere({ startDate: "2026-11-01", sort: "date_desc" }, 42)).toEqual({
      userId: 42,
      date: { gte: fromDateOnly("2026-11-01") },
    });

    expect(toWhere({ endDate: "2026-11-30", sort: "date_desc" }, 42)).toEqual({
      userId: 42,
      date: { lte: fromDateOnly("2026-11-30") },
    });

    expect(
      toWhere(
        {
          startDate: "2026-11-01",
          endDate: "2026-11-30",
          accountId: 2,
          kind: "PAYMENT",
          q: "50% _off",
          sort: "date_desc",
        },
        42,
      ),
    ).toEqual({
      userId: 42,
      date: { gte: fromDateOnly("2026-11-01"), lte: fromDateOnly("2026-11-30") },
      OR: [{ sourceAccountId: 2 }, { lines: { some: { accountId: 2 } } }],
      kind: "PAYMENT",
      note: { contains: "50\\% \\_off", mode: "insensitive" },
    });
  });

  it.each<[TransactionSort, object[]]>([
    ["date_desc", [{ date: "desc" }, { id: "desc" }]],
    ["date_asc", [{ date: "asc" }, { id: "asc" }]],
    ["amount_desc", [{ totalAmount: "desc" }, { id: "desc" }]],
    ["amount_asc", [{ totalAmount: "asc" }, { id: "asc" }]],
  ])("toOrderBy(%s) breaks ties by id in the same direction", (sort, expected) => {
    expect(toOrderBy(sort)).toEqual(expected);
  });
});
