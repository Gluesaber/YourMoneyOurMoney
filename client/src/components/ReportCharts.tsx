import type { MonthlyReport } from "../api/finance.js";

// F-11 §5 charts: plain SVG / CSS, no chart library (F-11 §8). They repeat what the tables beside them show, so they
// are hidden from screen readers; the tables are the accessible version.

// Income and expense bars per month.
export function MonthlyBarChart({ months }: { months: MonthlyReport["months"] }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const groupWidth = 28;
  const barWidth = 11;
  const height = 120;
  const width = Math.max(groupWidth * months.length, groupWidth);
  return (
    <figure className="mb-3" aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${height + 14}`}
        width="100%"
        style={{ maxWidth: Math.max(width * 3, 240), display: "block" }}
        role="presentation"
      >
        {months.map((m, i) => {
          const x = i * groupWidth + 2;
          const income = Math.round((m.income / max) * height);
          const expense = Math.round((m.expense / max) * height);
          return (
            <g key={m.month}>
              <rect x={x} y={height - income} width={barWidth} height={income} fill="var(--bs-success)" />
              <rect
                x={x + barWidth + 1}
                y={height - expense}
                width={barWidth}
                height={expense}
                fill="var(--bs-danger)"
              />
              <text x={x + barWidth} y={height + 11} fontSize="7" textAnchor="middle" fill="currentColor">
                {m.month.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="small text-body-secondary">
        <span className="text-success">■</span> Income <span className="text-danger ms-2">■</span> Expense
      </figcaption>
    </figure>
  );
}

// A horizontal bar for one category's share (basis points, 10,000 = 100 %).
export function ShareBar({ share }: { share: number }) {
  return (
    <div className="progress" style={{ height: 8, minWidth: 80 }} aria-hidden="true">
      <div className="progress-bar" style={{ width: `${share / 100}%` }} />
    </div>
  );
}
