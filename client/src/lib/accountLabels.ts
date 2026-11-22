import type { AccountSubtype, AccountType } from "../api/finance.js";

// Display names for account types and subtypes (F-06 §5).
export const TYPE_LABEL: Record<AccountType, string> = {
  CASH: "Cash (bank, wallet)",
  LOAN_TAKEN: "Loan taken / credit card",
  LOAN_GIVEN: "Loan given",
  INCOME: "Income category",
  EXPENSE: "Expense category",
};

export const SUBTYPE_LABEL: Record<AccountSubtype, string> = {
  BANK: "Bank",
  WALLET: "Wallet",
  CREDIT_CARD: "Credit card",
};
