import { z } from "zod";

// Shared request-validation helpers for Track B routes.

// PostgreSQL INTEGER limit: the most satang one value can hold, and the largest valid id.
export const MAX_INT = 2_147_483_647;

// A real calendar date in YYYY-MM-DD: "2026-02-30" has the right shape but does not exist.
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((s) => toDateOnly(fromDateOnly(s)) === s, "Not a real calendar date.");

// Dates are stored as UTC midnight in a DATE column, so they never shift with the server's time zone.
export function fromDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function toDateOnly(d: Date): string {
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// A path id that is not a positive integer within the INTEGER range is treated as "not found".
export function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_INT ? id : null;
}
