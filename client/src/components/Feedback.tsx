import { useEffect, useState } from "react";
import { ApiError } from "../api/client.js";
import { formatBaht } from "../lib/money.js";

// Shared page states (docs/system-sds.md §1.4 conventions).

export function Loading() {
  return (
    <div className="d-flex justify-content-center py-5" role="status" aria-label="Loading">
      <div className="spinner-border" />
    </div>
  );
}

export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger" role="alert">
      {messageOf(error)}
    </div>
  );
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

// Loads data once for a page. `data` is undefined while loading; `error` is set if the request fails.
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let current = true;
    setData(undefined);
    setError(null);
    load()
      .then((d) => current && setData(d))
      .catch((e) => current && setError(e));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}

// Today's date in the browser's local time zone, as YYYY-MM-DD.
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// An amount in baht; negative values are red with a minus sign.
export function Amount({ satang }: { satang: number }) {
  return <span className={satang < 0 ? "text-danger" : undefined}>{formatBaht(satang)}</span>;
}
