import { Link, useSearchParams } from "react-router-dom";
import {
  getCategoryBreakdown,
  getMonthlyReport,
  type CategoryBreakdown,
  type MonthlyReport,
  type ReportType,
} from "../api/finance.js";
import { Amount, ErrorAlert, Loading, useLoad } from "../components/Feedback.js";
import { MonthlyBarChart, ShareBar } from "../components/ReportCharts.js";
import { lastMonthRange, thisMonthRange, thisYearRange } from "../lib/dateRanges.js";

// F-11 §5 Reports page — docs/sprints/sprint-3/F-11-reports.md. The period lives in the URL
// (?from=&to=&startDate=&endDate=&type=), like the F-09 history filters; missing values fall back to the defaults:
// the last 12 months ending this month, and this calendar month for the breakdown (browser's local date).

const EMPTY = "No income or expense in this period.";
const TYPE_LABEL: Record<ReportType, string> = { EXPENSE: "Expense", INCOME: "Income" };

function localMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function defaultPeriod() {
  const today = new Date();
  const month = thisMonthRange(today);
  return {
    from: localMonth(new Date(today.getFullYear(), today.getMonth() - 11, 1)),
    to: localMonth(today),
    startDate: month.startDate,
    endDate: month.endDate,
    type: "EXPENSE" as ReportType,
  };
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const defaults = defaultPeriod();
  const period = {
    from: params.get("from") || defaults.from,
    to: params.get("to") || defaults.to,
    startDate: params.get("startDate") || defaults.startDate,
    endDate: params.get("endDate") || defaults.endDate,
    type: (params.get("type") === "INCOME" ? "INCOME" : "EXPENSE") as ReportType,
  };

  function update(changes: Partial<typeof period>) {
    const next = { ...period, ...changes };
    setParams(new URLSearchParams(next));
  }

  const monthly = useLoad(() => getMonthlyReport(period.from, period.to), [period.from, period.to]);
  const breakdown = useLoad(
    () => getCategoryBreakdown(period.startDate, period.endDate, period.type),
    [period.startDate, period.endDate, period.type],
  );

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Reports</h1>
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
          Back to the dashboard
        </Link>
      </div>
      <p className="text-body-secondary">
        Income and expense come only from your income and expense categories, so transfers, loans, repayments
        and opening balances never count.
      </p>

      <h2 className="h5">Income and expense by month</h2>
      <div className="row g-2 align-items-end mb-3" style={{ maxWidth: 480 }}>
        <div className="col-6">
          <label htmlFor="rep-from" className="form-label small">
            From month
          </label>
          <input
            id="rep-from"
            type="month"
            className="form-control form-control-sm"
            min="2000-01"
            max="2099-12"
            value={period.from}
            onChange={(e) => e.target.value && update({ from: e.target.value })}
          />
        </div>
        <div className="col-6">
          <label htmlFor="rep-to" className="form-label small">
            To month
          </label>
          <input
            id="rep-to"
            type="month"
            className="form-control form-control-sm"
            min="2000-01"
            max="2099-12"
            value={period.to}
            onChange={(e) => e.target.value && update({ to: e.target.value })}
          />
        </div>
      </div>
      <ErrorAlert error={monthly.error} />
      {!monthly.data && !monthly.error && <Loading />}
      {monthly.data && <MonthlyView report={monthly.data} />}

      <h2 className="h5 mt-4">{TYPE_LABEL[period.type]} by category</h2>
      <div className="row g-2 align-items-end mb-2">
        <div className="col-6 col-md-3">
          <label htmlFor="rep-start" className="form-label small">
            From
          </label>
          <input
            id="rep-start"
            type="date"
            className="form-control form-control-sm"
            min="2000-01-01"
            max="2099-12-31"
            value={period.startDate}
            onChange={(e) => e.target.value && update({ startDate: e.target.value })}
          />
        </div>
        <div className="col-6 col-md-3">
          <label htmlFor="rep-end" className="form-label small">
            To
          </label>
          <input
            id="rep-end"
            type="date"
            className="form-control form-control-sm"
            min="2000-01-01"
            max="2099-12-31"
            value={period.endDate}
            onChange={(e) => e.target.value && update({ endDate: e.target.value })}
          />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="rep-type" className="form-label small">
            Show
          </label>
          <select
            id="rep-type"
            className="form-select form-select-sm"
            value={period.type}
            onChange={(e) => update({ type: e.target.value as ReportType })}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>
        <div className="col-12 col-md-4 d-flex flex-wrap gap-2">
          {[
            ["This month", thisMonthRange],
            ["Last month", lastMonthRange],
            ["This year", thisYearRange],
          ].map(([label, range]) => (
            <button
              key={label as string}
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => update((range as typeof thisMonthRange)())}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <ErrorAlert error={breakdown.error} />
      {!breakdown.data && !breakdown.error && <Loading />}
      {breakdown.data && <BreakdownView report={breakdown.data} />}
    </section>
  );
}

function MonthlyView({ report }: { report: MonthlyReport }) {
  if (report.totals.income === 0 && report.totals.expense === 0) {
    return <p className="text-body-secondary">{EMPTY}</p>;
  }
  return (
    <>
      <MonthlyBarChart months={report.months} />
      <div className="table-responsive position-relative">
        <table className="table table-sm align-middle" aria-label="Income and expense by month">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className="text-end">
                Income
              </th>
              <th scope="col" className="text-end">
                Expense
              </th>
              <th scope="col" className="text-end">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {report.months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className="fw-normal">
                  {m.month}
                </th>
                <td className="text-end">
                  <Amount satang={m.income} />
                </td>
                <td className="text-end">
                  <Amount satang={m.expense} />
                </td>
                <td className="text-end">
                  <Amount satang={m.net} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-semibold">
              <th scope="row">Total</th>
              <td className="text-end">
                <Amount satang={report.totals.income} />
              </td>
              <td className="text-end">
                <Amount satang={report.totals.expense} />
              </td>
              <td className="text-end">
                <Amount satang={report.totals.net} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function BreakdownView({ report }: { report: CategoryBreakdown }) {
  if (report.categories.length === 0) {
    return <p className="text-body-secondary">{EMPTY}</p>;
  }
  return (
    <>
      <div className="table-responsive position-relative">
        <table className="table table-sm align-middle" aria-label={`${TYPE_LABEL[report.type]} by category`}>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="text-end">
                Amount
              </th>
              <th scope="col" className="text-end">
                Share
              </th>
              <th scope="col">
                <span className="visually-hidden">Share bar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {report.categories.map((c) => (
              <tr key={c.accountId}>
                <th scope="row" className="fw-normal">
                  {c.name}
                </th>
                <td className="text-end">
                  <Amount satang={c.total} />
                </td>
                <td className="text-end">{(c.share / 100).toFixed(2)} %</td>
                <td style={{ width: "30%" }}>
                  <ShareBar share={c.share} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Average per day ({report.days} days): <Amount satang={report.averageDaily} />
      </p>
    </>
  );
}
