import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ALLOWED_SUBTYPES,
  deleteAccount,
  getAccounts,
  setArchived,
  updateAccount,
  type Account,
  type AccountSubtype,
  type AccountType,
} from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";
import { SUBTYPE_LABEL, TYPE_LABEL } from "../lib/accountLabels.js";

// F-06 §5 Accounts page — docs/sprints/sprint-2/F-06-account-management.md.
const TYPES: AccountType[] = ["CASH", "LOAN_TAKEN", "LOAN_GIVEN", "INCOME", "EXPENSE"];

export function AccountsPage() {
  const [version, setVersion] = useState(0);
  const { data: accounts, error: loadError } = useLoad(getAccounts, [version]);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  // F-06 v0.4 §5: the row whose action is saving; its buttons stay disabled until the request ends.
  const [busy, setBusy] = useState<number | null>(null);

  async function run(id: number, action: () => Promise<unknown>) {
    setError(null);
    setBusy(id);
    try {
      await action();
      setEditing(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <ErrorAlert error={loadError} />;
  if (!accounts) return <Loading />;

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Accounts</h1>
        <div className="d-flex gap-2">
          <Link className="btn btn-primary" to="/accounts/new">
            New account
          </Link>
          <Link className="btn btn-outline-secondary" to="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
      <ErrorAlert error={error} />
      {TYPES.map((type) => {
        const rows = accounts.filter((a) => a.type === type);
        if (rows.length === 0) return null;
        return (
          <div key={type} className="mb-4">
            <h2 className="h5">{TYPE_LABEL[type]}</h2>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col" className="text-end">
                      Balance (THB)
                    </th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) =>
                    editing === a.id ? (
                      <EditRow
                        key={a.id}
                        account={a}
                        saving={busy === a.id}
                        onCancel={() => setEditing(null)}
                        onSave={(changes) => run(a.id, () => updateAccount(a.id, changes))}
                      />
                    ) : (
                      <tr key={a.id} className={a.archived ? "text-body-secondary" : undefined}>
                        <td>
                          {a.name}
                          {a.subtype && <span className="ms-2 small">({SUBTYPE_LABEL[a.subtype]})</span>}
                          {a.archived && <span className="badge text-bg-secondary ms-2">Archived</span>}
                        </td>
                        <td className="text-end">
                          <Amount satang={a.balance} />
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              disabled={busy === a.id}
                              onClick={() => setEditing(a.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              disabled={busy === a.id}
                              onClick={() => run(a.id, () => setArchived(a.id, !a.archived))}
                            >
                              {a.archived ? "Unarchive" : "Archive"}
                            </button>
                            {/* F-06 R9: only an account no transaction has used can be deleted. */}
                            {!a.inUse && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={busy === a.id}
                                onClick={() => {
                                  if (window.confirm(`Delete ${a.name}? This cannot be undone.`)) {
                                    void run(a.id, () => deleteAccount(a.id));
                                  }
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="small text-body-secondary">
        Archive keeps an account&apos;s history but hides it from new transactions; only an account with a 0
        balance can be archived. Delete works only for an account that has never been used. The type of an
        account cannot change once it has transactions.
      </p>
    </section>
  );
}

function EditRow({
  account,
  saving,
  onSave,
  onCancel,
}: {
  account: Account;
  saving: boolean;
  onSave: (changes: { name?: string; type?: AccountType; subtype?: AccountSubtype | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [subtype, setSubtype] = useState<AccountSubtype | "">(account.subtype ?? "");
  const subtypes = ALLOWED_SUBTYPES[type];
  // F-06 R5: the type and subtype of a used account cannot change, so they are not offered.
  const typeFixed = Boolean(account.inUse);

  function submit(e: FormEvent) {
    e.preventDefault();
    const changes: { name?: string; type?: AccountType; subtype?: AccountSubtype | null } = {};
    if (name.trim() !== account.name) changes.name = name.trim();
    if (type !== account.type) changes.type = type;
    if (type !== account.type || (subtype || null) !== account.subtype) changes.subtype = subtype || null;
    if (Object.keys(changes).length === 0) return onCancel();
    onSave(changes);
  }

  return (
    <tr>
      <td colSpan={3}>
        <form className="row g-2 align-items-end" onSubmit={submit} noValidate>
          {typeFixed && (
            <p className="col-12 small text-body-secondary mb-0">
              This account has transactions, so only its name can change.
            </p>
          )}
          <div className="col-12 col-md-4">
            <label htmlFor={`edit-name-${account.id}`} className="form-label small">
              Name
            </label>
            <input
              id={`edit-name-${account.id}`}
              className="form-control form-control-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {!typeFixed && (
            <div className="col-6 col-md-3">
              <label htmlFor={`edit-type-${account.id}`} className="form-label small">
                Type
              </label>
              <select
                id={`edit-type-${account.id}`}
                className="form-select form-select-sm"
                value={type}
                onChange={(e) => {
                  const next = e.target.value as AccountType;
                  setType(next);
                  if (!ALLOWED_SUBTYPES[next].includes(subtype as AccountSubtype)) setSubtype("");
                }}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!typeFixed && subtypes.length > 0 && (
            <div className="col-6 col-md-2">
              <label htmlFor={`edit-subtype-${account.id}`} className="form-label small">
                Subtype
              </label>
              <select
                id={`edit-subtype-${account.id}`}
                className="form-select form-select-sm"
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
          <div className="col-12 col-md-3 d-flex gap-2">
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
