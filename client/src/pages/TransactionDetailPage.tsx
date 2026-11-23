import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client.js";
import { getAccounts, getTransaction, type Transaction } from "../api/finance.js";
import { Amount, ErrorAlert, Loading, todayLocal, useLoad } from "../components/Feedback.js";
import { FavoriteToggle } from "../components/FavoriteToggle.js";
import { toDuplicateDraft } from "../lib/duplicate.js";
import { accountTypesOf, transferLabel } from "../lib/transactions.js";
import { KIND_LABEL } from "./TransactionsPage.js";

// F-05 §5 & F-10 §5 Transaction detail — docs/sprints/sprint-1/F-05-summary-history.md.
export function TransactionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: loaded, error } = useLoad(() => getTransaction(id), [id]);
  const [tx, setTx] = useState<Transaction | undefined>(undefined);
  const [favoriteError, setFavoriteError] = useState<unknown>(null);

  useEffect(() => {
    setTx(loaded);
    setFavoriteError(null);
  }, [loaded]);

  // F-07: a transfer is headed "Transfer: From → To"; without account types it falls back to the kind.
  const { data: accounts } = useLoad(getAccounts);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <section>
        <h1 className="h3">Transaction not found</h1>
        <Link to="/transactions">Back to history</Link>
      </section>
    );
  }
  if (error) return <ErrorAlert error={error} />;
  if (!tx) return <Loading />;

  return (
    <section style={{ maxWidth: 640 }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">{transferLabel(tx, accountTypesOf(accounts)) ?? KIND_LABEL[tx.kind]}</h1>
        <div className="d-flex gap-2">
          <FavoriteToggle
            transactionId={tx.id}
            isFavorite={tx.isFavorite}
            onToggled={setTx}
            onError={setFavoriteError}
          />
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() =>
              navigate(`/transactions/new?kind=${tx.kind}`, {
                state: { draft: toDuplicateDraft(tx, todayLocal()) },
              })
            }
          >
            Duplicate
          </button>
        </div>
      </div>
      <ErrorAlert error={favoriteError} />
      <dl className="row">
        <dt className="col-sm-4">Date</dt>
        <dd className="col-sm-8">{tx.date}</dd>
        <dt className="col-sm-4">{tx.kind === "PAYMENT" ? "Paid from" : "Received into"}</dt>
        <dd className="col-sm-8">{tx.source.name}</dd>
        {tx.note && (
          <>
            <dt className="col-sm-4">Note</dt>
            <dd className="col-sm-8 text-break">{tx.note}</dd>
          </>
        )}
      </dl>

      <table className="table align-middle">
        <thead>
          <tr>
            <th scope="col">{tx.kind === "PAYMENT" ? "Paid for" : "Received from"}</th>
            <th scope="col" className="text-end">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {tx.lines.map((l, i) => (
            <tr key={i}>
              <th scope="row" className="fw-normal">
                {l.name}
              </th>
              <td className="text-end">
                <Amount satang={l.amount} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="text-end fw-semibold">
              <Amount satang={tx.totalAmount} />
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="d-flex gap-2">
        <Link to="/transactions" className="btn btn-outline-secondary">
          Back to history
        </Link>
        <Link to="/dashboard" className="btn btn-outline-secondary">
          Dashboard
        </Link>
      </div>
    </section>
  );
}
