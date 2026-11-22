import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createTransaction, getAccounts, getSummary, type Account } from "../api/finance.js";
import { ErrorAlert, Loading, todayLocal, useLoad } from "../components/Feedback.js";
import {
  expectedLoanType,
  isLoanAction,
  isRepaymentAction,
  loanActionToTransaction,
  type LoanAction,
} from "../lib/loans.js";
import { formatBaht, toSatang } from "../lib/money.js";

// F-08 §5 Loan action form (/loans/:id/:action) — docs/sprints/sprint-2/F-08-loans.md.
export function LoanActionPage() {
  const { id, action } = useParams();
  const { data, error } = useLoad(() => Promise.all([getAccounts(), getSummary()]));

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading />;

  const [accounts, summary] = data;
  const loan = accounts.find((a) => String(a.id) === id);

  if (!isLoanAction(action) || !loan || loan.type !== expectedLoanType(action)) {
    return (
      <section>
        <h1 className="h3">Loan action</h1>
        <p>This account cannot be used for this loan action.</p>
        <Link to="/loans">Back to loans</Link>
      </section>
    );
  }

  if (loan.archived) {
    return (
      <section>
        <h1 className="h3">{headingFor(action, loan.name)}</h1>
        <p>This account is archived. Unarchive it before recording a transaction.</p>
        <Link to="/loans">Back to loans</Link>
      </section>
    );
  }

  const cashAccounts = accounts.filter((a) => a.type === "CASH" && !a.archived);
  if (cashAccounts.length === 0) {
    return (
      <section>
        <h1 className="h3">{headingFor(action, loan.name)}</h1>
        <p>You need an active cash account to record this loan transaction.</p>
        <Link to="/accounts/new?type=CASH">Add a cash account</Link>
      </section>
    );
  }

  const summaryList = loan.type === "LOAN_GIVEN" ? summary.loansGiven : summary.loansTaken;
  const outstanding = summaryList.find((e) => e.accountId === loan.id)?.outstanding ?? loan.balance;

  return <LoanActionForm action={action} loan={loan} outstanding={outstanding} cashAccounts={cashAccounts} />;
}

function headingFor(action: LoanAction, name: string): string {
  switch (action) {
    case "lend":
      return `Lend to ${name}`;
    case "repaid":
      return `Get repaid by ${name}`;
    case "borrow":
      return `Borrow from ${name}`;
    case "repay":
      return `Repay ${name}`;
  }
}

function LoanActionForm(props: {
  action: LoanAction;
  loan: Account;
  outstanding: number;
  cashAccounts: Account[];
}) {
  const navigate = useNavigate();
  const [cashAccountId, setCashAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const satang = toSatang(amount);
  const amountInvalid = amount !== "" && (satang === null || satang <= 0);
  const canSave = Boolean(cashAccountId && satang && satang > 0 && date) && !saving;
  const isOverRepayment =
    isRepaymentAction(props.action) && satang !== null && satang > 0 && satang > props.outstanding;

  async function submitTransaction() {
    if (!canSave || !satang) return;
    setSaving(true);
    setError(null);
    try {
      await createTransaction(
        loanActionToTransaction(props.action, {
          cashAccountId: Number(cashAccountId),
          loanAccountId: props.loan.id,
          amount: satang,
          date,
          note,
        }),
      );
      navigate("/loans");
    } catch (err) {
      setError(err);
      setSaving(false);
      setAwaitingConfirm(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave || !satang) return;
    if (isOverRepayment && !awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }
    void submitTransaction();
  }

  return (
    <section style={{ maxWidth: 480 }}>
      <h1 className="h3">{headingFor(props.action, props.loan.name)}</h1>
      <p className="text-body-secondary">
        Current outstanding: {formatBaht(props.outstanding)}. Moving money on a loan never counts as income or
        expense.
      </p>
      <ErrorAlert error={error} />
      {awaitingConfirm && (
        <div className="alert alert-warning" role="alert">
          <p className="mb-2">
            This is more than the {formatBaht(Math.max(0, props.outstanding))} outstanding.
          </p>
          <button
            type="button"
            className="btn btn-warning btn-sm"
            disabled={saving}
            onClick={() => void submitTransaction()}
          >
            Confirm and save
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="loan-cash" className="form-label">
            Cash account
          </label>
          <select
            id="loan-cash"
            className="form-select"
            value={cashAccountId}
            onChange={(e) => {
              setCashAccountId(e.target.value);
              setAwaitingConfirm(false);
            }}
          >
            <option value="">Choose an account</option>
            {props.cashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {formatBaht(a.balance)}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="loan-amount" className="form-label">
            Amount (THB)
          </label>
          <input
            id="loan-amount"
            className={`form-control text-end ${amountInvalid ? "is-invalid" : ""}`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAwaitingConfirm(false);
            }}
            aria-invalid={amountInvalid}
            aria-describedby="loan-amount-error"
          />
          {amountInvalid && (
            <div id="loan-amount-error" className="invalid-feedback">
              Enter an amount like 1,500.00 (more than zero, at most two decimals).
            </div>
          )}
        </div>
        <div className="mb-3">
          <label htmlFor="loan-date" className="form-label">
            Date
          </label>
          <input
            id="loan-date"
            type="date"
            className="form-control"
            min="2000-01-01"
            max="2099-12-31"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setAwaitingConfirm(false);
            }}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="loan-note" className="form-label">
            Note (optional)
          </label>
          <input
            id="loan-note"
            className="form-control"
            maxLength={200}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setAwaitingConfirm(false);
            }}
          />
        </div>
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            Save
          </button>
          <Link to="/loans" className="btn btn-outline-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
