import { Link } from "react-router-dom";
import { getSummary, type Summary } from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";

// F-05 §5 Dashboard — docs/sprints/sprint-1/F-05-summary-history.md. Numbers come straight from
// GET /api/summary; the page never computes a balance itself.
export function DashboardPage() {
  const { data: summary, error } = useLoad(getSummary);

  return (
    <section>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">Dashboard</h1>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-primary" to="/transactions/new?kind=PAYMENT">
            Record payment
          </Link>
          <Link className="btn btn-outline-primary" to="/transactions/new?kind=RECEIVE">
            Record money received
          </Link>
          <Link className="btn btn-outline-secondary" to="/transactions">
            History
          </Link>
        </div>
      </div>

      <ErrorAlert error={error} />
      {!summary && !error && <Loading />}
      {summary && <SummaryView summary={summary} />}
    </section>
  );
}

function SummaryView({ summary }: { summary: Summary }) {
  const allZero =
    summary.totals.income === 0 &&
    summary.totals.expense === 0 &&
    [...summary.cash.map((e) => e.balance), ...summary.loansTaken.map((e) => e.outstanding)].every(
      (v) => v === 0,
    );

  return (
    <>
      {allZero && (
        <div className="alert alert-info">
          Welcome! First, set the opening balance of your bank account and credit card.
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-6">
          <h2 className="h5">Accounts</h2>
          <AccountTable
            caption="Money you hold"
            amountHeader="Balance"
            rows={summary.cash.map((e) => ({ ...e, amount: e.balance }))}
          />
          <AccountTable
            caption="Money you owe"
            amountHeader="Outstanding"
            rows={summary.loansTaken.map((e) => ({ ...e, amount: e.outstanding }))}
          />
          {summary.loansGiven.length > 0 && (
            <AccountTable
              caption="Money owed to you"
              amountHeader="Outstanding"
              rows={summary.loansGiven.map((e) => ({ ...e, amount: e.outstanding }))}
            />
          )}
        </div>

        <div className="col-lg-6">
          <h2 className="h5">Income and expense</h2>
          <table className="table table-sm align-middle">
            <tbody>
              <tr>
                <th scope="row">Total income</th>
                <td className="text-end">
                  <Amount satang={summary.totals.income} />
                </td>
              </tr>
              <tr>
                <th scope="row">Total expense</th>
                <td className="text-end">
                  <Amount satang={summary.totals.expense} />
                </td>
              </tr>
            </tbody>
          </table>
          <CategoryTable caption="Income by category" rows={summary.income} />
          <CategoryTable caption="Expense by category" rows={summary.expense} />
        </div>
      </div>
    </>
  );
}

function AccountTable(props: {
  caption: string;
  amountHeader: string;
  rows: { accountId: number; name: string; amount: number }[];
}) {
  return (
    <table className="table table-sm align-middle caption-top">
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">Account</th>
          <th scope="col" className="text-end">
            {props.amountHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {/* Two columns only, so the table fits a 360px phone without sideways scrolling. */}
        {props.rows.map((r) => (
          <tr key={r.accountId}>
            <th scope="row">
              {r.name}
              <div>
                <Link
                  to={`/accounts/${r.accountId}/opening-balance`}
                  className="small fw-normal"
                  aria-label={`Set opening balance for ${r.name}`}
                >
                  Set opening balance
                </Link>
              </div>
            </th>
            <td className="text-end">
              <Amount satang={r.amount} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoryTable(props: {
  caption: string;
  rows: { accountId: number; name: string; total: number }[];
}) {
  return (
    <table className="table table-sm align-middle caption-top">
      <caption>{props.caption}</caption>
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.accountId}>
            <th scope="row" className="fw-normal">
              {r.name}
            </th>
            <td className="text-end">
              <Amount satang={r.total} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
