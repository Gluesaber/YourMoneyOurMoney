import type { NewTransaction, TransactionKind } from "../api/finance.js";

// F-08 §1, §2.1 — docs/sprints/sprint-2/F-08-loans.md. Pure mapping from loan UI actions
// to existing F-04 PAYMENT / RECEIVE transactions (never creates a new transaction kind).
export type LoanAction = "lend" | "repaid" | "borrow" | "repay";

export interface LoanActionFormInput {
  cashAccountId: number;
  loanAccountId: number;
  amount: number;
  date: string;
  note: string;
}

const ACTION_META: Record<
  LoanAction,
  { kind: TransactionKind; loanType: "LOAN_GIVEN" | "LOAN_TAKEN"; isRepayment: boolean }
> = {
  lend: { kind: "PAYMENT", loanType: "LOAN_GIVEN", isRepayment: false },
  repaid: { kind: "RECEIVE", loanType: "LOAN_GIVEN", isRepayment: true },
  borrow: { kind: "RECEIVE", loanType: "LOAN_TAKEN", isRepayment: false },
  repay: { kind: "PAYMENT", loanType: "LOAN_TAKEN", isRepayment: true },
};

export function isLoanAction(value: string | undefined): value is LoanAction {
  return value === "lend" || value === "repaid" || value === "borrow" || value === "repay";
}

export function expectedLoanType(action: LoanAction): "LOAN_GIVEN" | "LOAN_TAKEN" {
  return ACTION_META[action].loanType;
}

export function isRepaymentAction(action: LoanAction): boolean {
  return ACTION_META[action].isRepayment;
}

export function loanActionToTransaction(action: LoanAction, form: LoanActionFormInput): NewTransaction {
  return {
    kind: ACTION_META[action].kind,
    sourceAccountId: form.cashAccountId,
    date: form.date,
    totalAmount: form.amount,
    note: form.note.trim() || null,
    lines: [{ accountId: form.loanAccountId, amount: form.amount }],
  };
}
