import { Link, useNavigate } from "react-router-dom";
import { getTransactionList } from "../api/finance.js";
import { toDuplicateDraft } from "../lib/duplicate.js";
import { Amount, todayLocal, useLoad } from "./Feedback.js";

// F-10 §5 Dashboard Favorites card — docs/sprints/sprint-2/F-10-favorites-duplicate.md.
// Shows up to 5 newest favorites with a Duplicate action; hidden when there are none.
export function FavoritesCard() {
  const navigate = useNavigate();
  const { data, error } = useLoad(() => getTransactionList({ favorite: true }));

  if (error || !data || data.transactions.length === 0) return null;

  const shown = data.transactions.slice(0, 5);

  return (
    <section aria-labelledby="favorites-card-heading" className="card mt-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h2 id="favorites-card-heading" className="h5 mb-0">
          Favorites
        </h2>
        <Link to="/transactions?favorite=true" className="small">
          View all
        </Link>
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <tbody>
            {shown.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  <Link to={`/transactions/${t.id}`}>
                    {t.source.name} → {t.lines.map((l) => l.name).join(", ")}
                  </Link>
                  {t.note && <div className="small text-body-secondary text-truncate">{t.note}</div>}
                </td>
                <td className="text-end">
                  <Amount satang={t.totalAmount} />
                </td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() =>
                      navigate(`/transactions/new?kind=${t.kind}`, {
                        state: { draft: toDuplicateDraft(t, todayLocal()) },
                      })
                    }
                  >
                    Duplicate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
