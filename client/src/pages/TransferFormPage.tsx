import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTransaction, getAccounts, type Account } from "../api/finance.js";
import { ErrorAlert, Loading, fieldErrorsOf, todayLocal, useLoad } from "../components/Feedback.js";
import { formatBaht, toSatang } from "../lib/money.js";

// F-07 §5 Transfer form — docs/sprints/sprint-2/F-07-transfers.md. A transfer is saved as a PAYMENT from the
// From account with one CASH line to the To account (contract §1, §3); the server applies every F-04 rule.
export function TransferFormPage() {
  const { data: accounts, error } = useLoad(getAccounts);

  if (error) return <ErrorAlert error={error} />;
  if (!accounts) return <Loading />;
  return <TransferForm cashAccounts={accounts.filter((a) => a.type === "CASH" && !a.archived)} />;
}

function TransferForm({ cashAccounts }: { cashAccounts: Account[] }) {
  const navigate = useNavigate();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const satang = toSatang(amount);
  const destinations = cashAccounts.filter((a) => String(a.id) !== fromId);
  const amountInvalid = amount !== "" && (satang === null || satang <= 0);
  // F-07 v0.4: a server field error on `date` marks the Date field, as the other forms do (#60).
  const dateError = fieldErrorsOf(error).date?.[0];
  const canSave = Boolean(fromId && toId && fromId !== toId && satang && satang > 0 && date) && !saving;

  function changeFrom(id: string) {
    setFromId(id);
    if (id === toId) setToId("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave || !satang) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createTransaction({
        kind: "PAYMENT",
        sourceAccountId: Number(fromId),
        date,
        totalAmount: satang,
        note: note.trim() || null,
        lines: [{ accountId: Number(toId), amount: satang }],
      });
      navigate(`/transactions/${created.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  if (cashAccounts.length < 2) {
    return (
      <section style={{ maxWidth: 480 }}>
        <h1 className="h3">Transfer between cash accounts</h1>
        <p>You need at least two active cash accounts to make a transfer.</p>
        <Link to="/accounts/new">Add a cash account</Link>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 480 }}>
      <h1 className="h3">Transfer between cash accounts</h1>
      <p className="text-body-secondary">
        Moving money between your own accounts is never income or expense.
      </p>
      <ErrorAlert error={error} />
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="trf-from" className="form-label">
            From
          </label>
          <select
            id="trf-from"
            className="form-select"
            value={fromId}
            onChange={(e) => changeFrom(e.target.value)}
          >
            <option value="">Choose an account</option>
            <CashOptions accounts={cashAccounts} />
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="trf-to" className="form-label">
            To
          </label>
          <select id="trf-to" className="form-select" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Choose an account</option>
            <CashOptions accounts={destinations} />
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="trf-amount" className="form-label">
            Amount (THB)
          </label>
          <input
            id="trf-amount"
            className={`form-control text-end ${amountInvalid ? "is-invalid" : ""}`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amountInvalid}
            aria-describedby="trf-amount-error"
          />
          {amountInvalid && (
            <div id="trf-amount-error" className="invalid-feedback">
              Enter an amount like 1,500.00 (more than zero, at most two decimals).
            </div>
          )}
        </div>
        <div className="mb-3">
          <label htmlFor="trf-date" className="form-label">
            Date
          </label>
          <input
            id="trf-date"
            type="date"
            className={`form-control ${dateError ? "is-invalid" : ""}`}
            min="2000-01-01"
            max="2099-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(dateError)}
            aria-describedby="trf-date-error"
          />
          {dateError && (
            <div id="trf-date-error" className="invalid-feedback">
              {dateError}
            </div>
          )}
        </div>
        <div className="mb-3">
          <label htmlFor="trf-note" className="form-label">
            Note (optional)
          </label>
          <input
            id="trf-note"
            className="form-control"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
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

// "Bank · 38,500.00": the current balance helps pick the account to move money from.
function CashOptions({ accounts }: { accounts: Account[] }) {
  return (
    <>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {formatBaht(a.balance)}
        </option>
      ))}
    </>
  );
}
