import type { Prisma, TransactionKind } from "@prisma/client";
import { z } from "zod";
import { MAX_INT, calendarDate, fromDateOnly } from "./validation.js";

// F-09 Transaction search, filtering and sorting — docs/sprints/sprint-2/F-09-search-filter.md §2.
export const MAX_TRANSACTION_ROWS = 500;
export const SORT_VALUES = ["date_desc", "date_asc", "amount_desc", "amount_asc"] as const;
export type TransactionSort = (typeof SORT_VALUES)[number];

const queryAccountId = z
  .string()
  .regex(/^\d+$/, "Account ID must be a positive integer.")
  .transform(Number)
  .refine((n) => n >= 1 && n <= MAX_INT, "Account ID is out of range.");

export const transactionQuerySchema = z
  .object({
    startDate: calendarDate.optional(),
    endDate: calendarDate.optional(),
    accountId: queryAccountId.optional(),
    kind: z.enum(["PAYMENT", "RECEIVE"]).optional(),
    q: z
      .string()
      .trim()
      .max(100, "Use 100 characters or fewer.")
      .optional()
      .transform((s) => (s ? s : undefined)),
    sort: z.enum(SORT_VALUES).default("date_desc"),
    favorite: z
      .enum(["true"])
      .transform(() => true as const)
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.startDate && val.endDate && val.startDate > val.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date cannot be after end date.",
      });
    }
  });

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export function parseTransactionQuery(raw: Record<string, unknown>): TransactionQuery {
  return transactionQuerySchema.parse(raw);
}

// F-09 R4: escape SQL LIKE wildcards so Prisma `contains` matches `%`, `_`, and `\` literally in PostgreSQL.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function toWhere(query: TransactionQuery, userId: number): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (query.startDate || query.endDate) {
    where.date = {
      ...(query.startDate ? { gte: fromDateOnly(query.startDate) } : {}),
      ...(query.endDate ? { lte: fromDateOnly(query.endDate) } : {}),
    };
  }
  if (query.accountId !== undefined) {
    where.OR = [{ sourceAccountId: query.accountId }, { lines: { some: { accountId: query.accountId } } }];
  }
  if (query.kind !== undefined) {
    where.kind = query.kind as TransactionKind;
  }
  if (query.q !== undefined) {
    where.note = { contains: escapeLike(query.q), mode: "insensitive" };
  }
  if (query.favorite) {
    where.isFavorite = true;
  }
  return where;
}

export function toOrderBy(sort: TransactionSort): Prisma.TransactionOrderByWithRelationInput[] {
  switch (sort) {
    case "date_asc":
      return [{ date: "asc" }, { id: "asc" }];
    case "amount_desc":
      return [{ totalAmount: "desc" }, { id: "desc" }];
    case "amount_asc":
      return [{ totalAmount: "asc" }, { id: "asc" }];
    case "date_desc":
    default:
      return [{ date: "desc" }, { id: "desc" }];
  }
}
