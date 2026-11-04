import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LINE_TYPES,
  SOURCE_TYPES,
  createTransaction,
  getAccounts,
  type Account,
  type AccountType,
  type TransactionKind,
} from "../api/finance.js";
import { ErrorAlert, Loading, todayLocal, useLoad } from "../components/Feedback.js";
import { formatBaht, toSatang } from "../lib/money.js";

// F-04 §5 Payment / Receive form — docs/sprints/sprint-1/F-04-transactions.md.
// The form only offers accounts the server will accept (BR-09, BR-10, BR-11) and only enables Save when
// the lines add up exactly (BR-01); the server still checks everything.

const TEXT: Record<TransactionKind, { title: string; source: string; lines: string }> = {
  PAYMENT: { title: "Record payment", source: "Paid from", lines: "Paid for" },
  RECEIVE: { title: "Record money received", source: "Received into", lines: "Received from" },
};

const TYPE_LABEL: Record<AccountType, string> = {
  CASH: "Cash and bank",
  LOAN_TAKEN: "Money you owe",
  LOAN_GIVEN: "Money owed to you",
  INCOME: "Income",
  EXPENSE: "Expense",
};

const MAX_LINES = 20;

interface Line {
  key: number;
  accountId: string;
  amount: string;
}

export function TransactionFormPage() {
  const [params] = useSearchParams();
  const kind: TransactionKind = params.get("kind") === "RECEIVE" ? "RECEIVE" : "PAYMENT";
  const { data: accounts, error } = useLoad(getAccounts);

  if (error) return <ErrorAlert error={error} />;
  if (!accounts) return <Loading />;
  // `key` resets the form when switching between Payment and Receive.
  return <TransactionForm key={kind} kind={kind} accounts={accounts} />;
}

function TransactionForm({ kind, accounts }: { kind: TransactionKind; accounts: Account[] }) {
  const navigate = useNavigate();
  const text = TEXT[kind];
  const [sourceId, setSourceId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, accountId: "", amount: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const sources = accounts.filter((a) => SOURCE_TYPES[kind].includes(a.type));
  const lineAccounts = accounts.filter((a) => LINE_TYPES[kind].includes(a.type) && String(a.id) !== sourceId);

  const totalSatang = toSatang(total);
  const lineSatang = lines.map((l) => toSatang(l.amount));
  const remaining =
    totalSatang !== null && lineSatang.every((s) => s !== null)
      ? totalSatang - lineSatang.reduce<number>((sum, s) => sum + (s ?? 0), 0)
      : null;

  const complete =
    sourceId !== "" &&
    date !== "" &&
    totalSatang !== null &&
    totalSatang > 0 &&
    lines.every((l, i) => l.accountId !== "" && lineSatang[i] !== null && lineSatang[i]! > 0) &&
    remaining === 0;

  function updateLine(key: number, change: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  function changeSource(id: string) {
    setSourceId(id);
    // A line cannot use the source account (BR-11).
    setLines((ls) => ls.map((l) => (l.accountId === id ? { ...l, accountId: "" } : l)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createTransaction({
        kind,
        sourceAccountId: Number(sourceId),
        date,
        totalAmount: totalSatang!,
        note: note.trim() || null,
        lines: lines.map((l, i) => ({ accountId: Number(l.accountId), amount: lineSatang[i]! })),
      });
      navigate(`/transactions/${created.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <section style={{ maxWidth: 720 }}>
      <h1 className="h3">{text.title}</h1>
      <ErrorAlert error={error} />
      <form onSubmit={onSubmit} noValidate>
        <div className="row g-3 mb-3">
          <div className="col-sm-6">
            <label htmlFor="tx-source" className="form-label">
              {text.source}
            </label>
            <select
              id="tx-source"
              className="form-select"
              value={sourceId}
              onChange={(e) => changeSource(e.target.value)}
            >
              <option value="">Choose an account</option>
              <AccountOptions accounts={sources} />
            </select>
          </div>
          <div className="col-sm-6">
            <label htmlFor="tx-date" className="form-label">
              Date
            </label>
            <input
              id="tx-date"
              type="date"
              className="form-control"
              min="2000-01-01"
              max="2099-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="col-sm-6">
            <MoneyInput id="tx-total" label="Total (THB)" value={total} onChange={setTotal} />
          </div>
          <div className="col-sm-6">
            <label htmlFor="tx-note" className="form-label">
              Note (optional)
            </label>
            <input
              id="tx-note"
              className="form-control"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="mb-3">
          <legend className="h6">{text.lines}</legend>
          {lines.map((line, i) => (
            <div className="row g-2 align-items-end mb-2" key={line.key}>
              <div className="col-sm-6">
                <label htmlFor={`line-account-${line.key}`} className="form-label small">
                  Account for line {i + 1}
                </label>
                <select
                  id={`line-account-${line.key}`}
                  className="form-select"
                  value={line.accountId}
                  onChange={(e) => updateLine(line.key, { accountId: e.target.value })}
                >
                  <option value="">Choose an account</option>
                  <AccountOptions accounts={lineAccounts} />
                </select>
              </div>
              <div className="col-sm-4">
                <MoneyInput
                  id={`line-amount-${line.key}`}
                  label={`Amount for line ${i + 1}`}
                  small
                  value={line.amount}
                  onChange={(amount) => updateLine(line.key, { amount })}
                />
              </div>
              <div className="col-sm-2">
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline-danger w-100"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={lines.length >= MAX_LINES}
            onClick={() => {
              setLines((ls) => [...ls, { key: nextKey, accountId: "", amount: "" }]);
              setNextKey((k) => k + 1);
            }}
          >
            Add line
          </button>
        </fieldset>

        <p aria-live="polite">
          Remaining to allocate:{" "}
          <strong className={remaining === 0 ? "text-success" : "text-danger"}>
            {remaining === null ? "—" : formatBaht(remaining)}
          </strong>
        </p>

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={!complete || saving}>
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

// Options grouped by account type, in the order the server lists accounts.
function AccountOptions({ accounts }: { accounts: Account[] }) {
  const types = [...new Set(accounts.map((a) => a.type))];
  return (
    <>
      {types.map((type) => (
        <optgroup key={type} label={TYPE_LABEL[type]}>
          {accounts
            .filter((a) => a.type === type)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

function MoneyInput(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  small?: boolean;
}) {
  const invalid = props.value.trim() !== "" && toSatang(props.value) === null;
  return (
    <>
      <label htmlFor={props.id} className={`form-label ${props.small ? "small" : ""}`}>
        {props.label}
      </label>
      <input
        id={props.id}
        className={`form-control text-end ${invalid ? "is-invalid" : ""}`}
        inputMode="decimal"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={invalid}
      />
      {invalid && <div className="invalid-feedback">Enter an amount like 1,500.00.</div>}
    </>
  );
}
