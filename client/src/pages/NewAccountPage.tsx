import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ALLOWED_SUBTYPES, createAccount, type AccountSubtype, type AccountType } from "../api/finance.js";
import { ErrorAlert } from "../components/Feedback.js";
import { SUBTYPE_LABEL, TYPE_LABEL } from "../lib/accountLabels.js";

// F-06 §5 New account form — docs/sprints/sprint-2/F-06-account-management.md.
const TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"];

export function NewAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get("type") as AccountType | null;
  const initialType: AccountType = typeParam && TYPES.includes(typeParam) ? typeParam : "EXPENSE";
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>(initialType);
  const [subtype, setSubtype] = useState<AccountSubtype | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const subtypes = ALLOWED_SUBTYPES[type];
  const trimmed = name.trim();
  const canSave = trimmed.length >= 1 && trimmed.length <= 50 && !saving;

  function changeType(next: AccountType) {
    setType(next);
    // A subtype that does not fit the new type is dropped, as the server does on a type change (R4).
    if (!ALLOWED_SUBTYPES[next].includes(subtype as AccountSubtype)) setSubtype("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await createAccount({ name: trimmed, type, subtype: subtype || null });
      navigate("/accounts");
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <section style={{ maxWidth: 480 }}>
      <h1 className="h3">New account</h1>
      <ErrorAlert error={error} />
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="acc-name" className="form-label">
            Name
          </label>
          <input
            id="acc-name"
            className="form-control"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="form-text">1 to 50 characters, different from your other accounts.</div>
        </div>
        <div className="mb-3">
          <label htmlFor="acc-type" className="form-label">
            Type
          </label>
          <select
            id="acc-type"
            className="form-select"
            value={type}
            onChange={(e) => changeType(e.target.value as AccountType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {subtypes.length > 0 && (
          <div className="mb-3">
            <label htmlFor="acc-subtype" className="form-label">
              Subtype
            </label>
            <select
              id="acc-subtype"
              className="form-select"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value as AccountSubtype | "")}
            >
              <option value="">None</option>
              {subtypes.map((s) => (
                <option key={s} value={s}>
                  {SUBTYPE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={!canSave}>
            Save
          </button>
          <Link to="/accounts" className="btn btn-outline-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
