import { describe, expect, it } from "vitest";
import type { AccountSubtype, AccountType } from "@prisma/client";
import { AppError } from "../../src/lib/errors.js";
import { validateAccountShape } from "../../src/services/accounts.js";

// validateAccountShape — R4 of docs/sprints/sprint-2/F-06-account-management.md §2.
const TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"];
const SUBTYPES: (AccountSubtype | null)[] = [null, "BANK", "WALLET", "CREDIT_CARD"];

const ALLOWED: Record<AccountType, (AccountSubtype | null)[]> = {
  CASH: [null, "BANK", "WALLET"],
  LOAN_TAKEN: [null, "CREDIT_CARD"],
  LOAN_GIVEN: [null],
  INCOME: [null],
  EXPENSE: [null],
};

const CASES = TYPES.flatMap((type) =>
  SUBTYPES.map((subtype) => ({ type, subtype, allowed: ALLOWED[type].includes(subtype) })),
);

describe("validateAccountShape (F-06 R4)", () => {
  it("covers every type × subtype pair", () => {
    expect(CASES).toHaveLength(20);
    expect(CASES.filter((c) => c.allowed)).toHaveLength(7);
  });

  it.each(CASES.filter((c) => c.allowed))(
    "T-ACC-UNIT-01: $type + $subtype is allowed",
    ({ type, subtype }) => {
      expect(() => validateAccountShape(type, subtype)).not.toThrow();
    },
  );

  it.each(CASES.filter((c) => !c.allowed))(
    "T-ACC-UNIT-01: $type + $subtype → VALIDATION_ERROR on subtype",
    ({ type, subtype }) => {
      let thrown: unknown;
      try {
        validateAccountShape(type, subtype);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(AppError);
      expect(thrown).toMatchObject({ status: 400, code: "VALIDATION_ERROR", details: { field: "subtype" } });
    },
  );
});
