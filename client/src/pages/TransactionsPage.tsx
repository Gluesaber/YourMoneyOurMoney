import { Link } from "react-router-dom";
import { getAccounts, getTransactions } from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";
import { accountTypesOf, transferLabel } from "../lib/transactions.js";

export const KIND_LABEL = { PAYMENT: "Payment", RECEIVE: "Money received" } as const;

// F-05 §5 History — docs/sprints/sprint-1/F-05-summary-history.md. Shown in the server's order
// (newest date first, then most recently entered).
export function TransactionsPage() {
  const { data: transactions, error } = useLoad(getTransactions);
  // F-07: account types label transfers. If they fail to load the list still shows, just without labels.
  const { data: accounts } = useLoad(getAccounts);
  const types = accountTypesOf(accounts);

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">History</h1>
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
          Back to the dashboard
        </Link>
      </div>
      <ErrorAlert error={error} />
      {!transactions && !error && <Loading />}
      {transactions?.length === 0 && <p className="text-body-secondary">No transactions yet.</p>}
      {transactions && transactions.length > 0 && (
        // position-relative keeps the visually-hidden header inside the scroll box, so only the table
        // scrolls sideways on a phone, never the whole page.
        <div className="table-responsive position-relative">
          <table className="table align-middle">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Kind</th>
                <th scope="col">Account</th>
                <th scope="col">Allocated to</th>
                <th scope="col" className="text-end">
                  Total
                </th>
                <th scope="col">
                  <span className="visually-hidden">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{transferLabel(t, types) ?? KIND_LABEL[t.kind]}</td>
                  <td>{t.source.name}</td>
                  <td>{t.lines.map((l) => l.name).join(", ")}</td>
                  <td className="text-end">
                    <Amount satang={t.totalAmount} />
                  </td>
                  <td className="text-end">
                    <Link to={`/transactions/${t.id}`}>Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
