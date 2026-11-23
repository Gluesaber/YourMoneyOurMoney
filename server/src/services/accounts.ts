import type { AccountSubtype, AccountType } from "@prisma/client";
import { AppError, ErrorCode } from "../lib/errors.js";

// F-06 account rules that need no database (docs/sprints/sprint-2/F-06-account-management.md §2).
// Plain functions only, so they can be unit-tested on their own.

// R4: the subtypes each type may have. The database CHECK "Account_subtype_matches_type" backs this up.
export const ALLOWED_SUBTYPES: Record<AccountType, (AccountSubtype | null)[]> = {
  CASH: [null, "BANK", "WALLET"],
  LOAN_TAKEN: [null, "CREDIT_CARD"],
  LOAN_GIVEN: [null],
  INCOME: [null],
  EXPENSE: [null],
};

// BR-12: only these types may hold an opening balance (also F-06 R6).
export const OPENING_BALANCE_TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN"];

// R8: types whose balance is money or debt, so they can only be archived when it is 0.
export const BALANCE_TYPES: AccountType[] = OPENING_BALANCE_TYPES;

export const MAX_ACCOUNTS_PER_USER = 100;

export function validateAccountShape(type: AccountType, subtype: AccountSubtype | null): void {
  if (!ALLOWED_SUBTYPES[type].includes(subtype)) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      // null fits every type, so only a named subtype can be wrong here.
      `A ${label(type)} account cannot have the subtype ${label(subtype ?? "")}.`,
      { field: "subtype", type, subtype },
    );
  }
}

function label(value: string): string {
  return value.toLowerCase().replace("_", " ");
}
