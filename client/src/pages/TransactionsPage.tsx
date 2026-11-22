import { Link, useSearchParams } from "react-router-dom";
import {
  buildTransactionQueryString,
  getAccounts,
  getTransactionList,
  type TransactionFilters,
  type TransactionKind,
  type TransactionSort,
} from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";
import { TransactionFilterBar } from "../components/TransactionFilterBar.js";
import { accountTypesOf, transferLabel } from "../lib/transactions.js";

export const KIND_LABEL = { PAYMENT: "Payment", RECEIVE: "Money received" } as const;

// F-05 §5 & F-09 §5 History — docs/sprints/sprint-2/F-09-search-filter.md.
// Filters stay synced with URL query params so reload/back preserves them.
export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: TransactionFilters = {
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    accountId: searchParams.get("accountId") ?? "",
    kind: (searchParams.get("kind") as TransactionKind | null) ?? "",
    q: searchParams.get("q") ?? "",
    sort: (searchParams.get("sort") as TransactionSort | null) ?? "date_desc",
  };

  const queryString = buildTransactionQueryString(filters);
  const { data, error } = useLoad(() => getTransactionList(filters), [queryString]);
  // F-07 / F-09: account types label transfers and populate Account filter options.
  const { data: accounts } = useLoad(getAccounts);
  const types = accountTypesOf(accounts);

  const transactions = data?.transactions;
  const hasActiveFilters = queryString.length > 0;

  function updateFilters(next: TransactionFilters) {
    setSearchParams(new URLSearchParams(buildTransactionQueryString(next)));
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams());
  }

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">History</h1>
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
          Back to the dashboard
        </Link>
      </div>
      <TransactionFilterBar
        filters={filters}
        accounts={accounts}
        onChange={updateFilters}
        onClear={clearFilters}
      />
      <ErrorAlert error={error} />
      {!transactions && !error && <Loading />}
      {data?.truncated && (
        <div className="alert alert-info">
          Showing the first 500 matching transactions. Narrow the filters to see more.
        </div>
      )}
      {transactions?.length === 0 && !hasActiveFilters && (
        <p className="text-body-secondary">No transactions yet.</p>
      )}
      {transactions?.length === 0 && hasActiveFilters && (
        <p className="text-body-secondary">
          No transactions match these filters.{" "}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={clearFilters}>
            Clear
          </button>
        </p>
      )}
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
