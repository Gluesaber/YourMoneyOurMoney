import { useEffect, useRef, useState } from "react";
import type { Account, TransactionFilters, TransactionKind, TransactionSort } from "../api/finance.js";
import { lastMonthRange, thisMonthRange, thisYearRange } from "../lib/dateRanges.js";

// F-09 §5 History filter bar — docs/sprints/sprint-2/F-09-search-filter.md.
export function TransactionFilterBar(props: {
  filters: TransactionFilters;
  accounts: Account[] | undefined;
  onChange: (next: TransactionFilters) => void;
  onClear: () => void;
}) {
  const [searchInput, setSearchInput] = useState(props.filters.q ?? "");
  const timerRef = useRef<number | undefined>(undefined);
  const filtersRef = useRef(props.filters);
  const onChangeRef = useRef(props.onChange);

  filtersRef.current = props.filters;
  onChangeRef.current = props.onChange;

  useEffect(() => {
    setSearchInput(props.filters.q ?? "");
  }, [props.filters.q]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
  }, []);

  function update(patch: Partial<TransactionFilters>) {
    props.onChange({ ...props.filters, ...patch });
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      onChangeRef.current({ ...filtersRef.current, q: value.trim() });
    }, 250);
  }

  function handleClear() {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    setSearchInput("");
    props.onClear();
  }

  return (
    <div className="card card-body mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-6 col-md-2">
          <label htmlFor="hst-start" className="form-label form-label-sm mb-1">
            From
          </label>
          <input
            id="hst-start"
            type="date"
            className="form-control form-control-sm"
            min="2000-01-01"
            max="2099-12-31"
            value={props.filters.startDate ?? ""}
            onChange={(e) => update({ startDate: e.target.value })}
          />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="hst-end" className="form-label form-label-sm mb-1">
            To
          </label>
          <input
            id="hst-end"
            type="date"
            className="form-control form-control-sm"
            min="2000-01-01"
            max="2099-12-31"
            value={props.filters.endDate ?? ""}
            onChange={(e) => update({ endDate: e.target.value })}
          />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="hst-account" className="form-label form-label-sm mb-1">
            Account
          </label>
          <select
            id="hst-account"
            className="form-select form-select-sm"
            value={props.filters.accountId ?? ""}
            onChange={(e) => update({ accountId: e.target.value })}
          >
            <option value="">All accounts</option>
            {props.accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? " (Archived)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="hst-kind" className="form-label form-label-sm mb-1">
            Kind
          </label>
          <select
            id="hst-kind"
            className="form-select form-select-sm"
            value={props.filters.kind ?? ""}
            onChange={(e) => update({ kind: e.target.value as TransactionKind | "" })}
          >
            <option value="">All</option>
            <option value="PAYMENT">Payment</option>
            <option value="RECEIVE">Receive</option>
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="hst-q" className="form-label form-label-sm mb-1">
            Search
          </label>
          <input
            id="hst-q"
            type="search"
            className="form-control form-control-sm"
            maxLength={100}
            placeholder="Search notes..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="hst-sort" className="form-label form-label-sm mb-1">
            Sort
          </label>
          <select
            id="hst-sort"
            className="form-select form-select-sm"
            value={props.filters.sort ?? "date_desc"}
            onChange={(e) => update({ sort: e.target.value as TransactionSort })}
          >
            <option value="date_desc">Date (newest first)</option>
            <option value="date_asc">Date (oldest first)</option>
            <option value="amount_desc">Amount (highest first)</option>
            <option value="amount_asc">Amount (lowest first)</option>
          </select>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => update(thisMonthRange())}
        >
          This month
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => update(lastMonthRange())}
        >
          Last month
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => update(thisYearRange())}
        >
          This year
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
