import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client.js";
import { getTransaction } from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";
import { KIND_LABEL } from "./TransactionsPage.js";

// F-05 §5 Transaction detail — docs/sprints/sprint-1/F-05-summary-history.md. Another user's, a missing
// and a non-numeric id all come back as 404 from the server and show the same "not found" page.
export function TransactionDetailPage() {
  const { id = "" } = useParams();
  const { data: t, error } = useLoad(() => getTransaction(id), [id]);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <section>
        <h1 className="h3">Transaction not found</h1>
        <Link to="/transactions">Back to history</Link>
      </section>
    );
  }
  if (error) return <ErrorAlert error={error} />;
  if (!t) return <Loading />;

  return (
    <section style={{ maxWidth: 640 }}>
      <h1 className="h3">{KIND_LABEL[t.kind]}</h1>
      <dl className="row">
        <dt className="col-sm-4">Date</dt>
        <dd className="col-sm-8">{t.date}</dd>
        <dt className="col-sm-4">{t.kind === "PAYMENT" ? "Paid from" : "Received into"}</dt>
        <dd className="col-sm-8">{t.source.name}</dd>
        {t.note && (
          <>
            <dt className="col-sm-4">Note</dt>
            <dd className="col-sm-8">{t.note}</dd>
          </>
        )}
      </dl>

      <table className="table align-middle">
        <thead>
          <tr>
            <th scope="col">{t.kind === "PAYMENT" ? "Paid for" : "Received from"}</th>
            <th scope="col" className="text-end">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {t.lines.map((l, i) => (
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
              <Amount satang={t.totalAmount} />
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
