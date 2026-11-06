import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { OPENING_BALANCE_TYPES, getAccounts, setOpeningBalance, type Account } from "../api/finance.js";
import { ErrorAlert, Loading, todayLocal, useLoad } from "../components/Feedback.js";
import { formatBaht, toSatang } from "../lib/money.js";

// F-03 §5 Opening balance form — docs/sprints/sprint-1/F-03-accounts.md.
export function OpeningBalancePage() {
  const { id } = useParams();
  const { data: accounts, error } = useLoad(getAccounts);
  const account = accounts?.find((a) => String(a.id) === id);

  if (error) return <ErrorAlert error={error} />;
  if (!accounts) return <Loading />;
  if (!account || !OPENING_BALANCE_TYPES.includes(account.type)) {
    return (
      <section>
        <h1 className="h3">Opening balance</h1>
        <p>This account cannot have an opening balance.</p>
        <Link to="/dashboard">Back to the dashboard</Link>
      </section>
    );
  }
  return <OpeningBalanceForm account={account} />;
}

function OpeningBalanceForm({ account }: { account: Account }) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(formatBaht(account.openingBalance));
  const [date, setDate] = useState(account.openingDate ?? todayLocal());
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const satang = toSatang(amount);
  const amountInvalid = showErrors && satang === null;
  const dateInvalid = showErrors && !date;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    if (satang === null || !date) return;
    setSaving(true);
    setError(null);
    try {
      await setOpeningBalance(account.id, satang, date);
      navigate("/dashboard");
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <section style={{ maxWidth: 480 }}>
      <h1 className="h3">Opening balance: {account.name}</h1>
      <p className="text-body-secondary">
        What the account held (or owed) on the date you start recording. It never counts as income or expense.
      </p>
      <ErrorAlert error={error} />
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="ob-amount" className="form-label">
            Amount (THB)
          </label>
          <input
            id="ob-amount"
            className={`form-control text-end ${amountInvalid ? "is-invalid" : ""}`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amountInvalid}
            aria-describedby="ob-amount-error"
          />
          {amountInvalid && (
            <div id="ob-amount-error" className="invalid-feedback">
              Enter an amount like 1,500.00 (zero or more, at most two decimals).
            </div>
          )}
        </div>
        <div className="mb-3">
          <label htmlFor="ob-date" className="form-label">
            Date
          </label>
          <input
            id="ob-date"
            type="date"
            className={`form-control ${dateInvalid ? "is-invalid" : ""}`}
            min="2000-01-01"
            max="2099-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={dateInvalid}
          />
          {dateInvalid && <div className="invalid-feedback">Choose a date.</div>}
        </div>
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Save
          </button>
          <Link to="/dashboard" className="btn btn-outline-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
