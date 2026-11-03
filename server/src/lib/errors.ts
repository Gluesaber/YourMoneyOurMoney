import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Integration point 6. Add new codes here by PR so both tracks use the same list.
export const ErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED", // 401
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS", // 401
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED", // 403
  FORBIDDEN: "FORBIDDEN", // 403
  NOT_FOUND: "NOT_FOUND", // 404
  VALIDATION_ERROR: "VALIDATION_ERROR", // 400
  ALLOCATION_MISMATCH: "ALLOCATION_MISMATCH", // 400
  INVALID_ACCOUNT_TYPE: "INVALID_ACCOUNT_TYPE", // 400
  SELF_DISABLE_NOT_ALLOWED: "SELF_DISABLE_NOT_ALLOWED", // 400
  INTERNAL_ERROR: "INTERNAL_ERROR", // 500
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

// Integration point 5. Throw this from routes and services; errorHandler turns it into the shared shape.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, ErrorCode.NOT_FOUND, "Not found."));
}

// Must be registered last, after every route. Express recognises it as an error handler by its 4 arguments.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json(toBody(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json(toBody(ErrorCode.VALIDATION_ERROR, "Invalid request.", err.flatten()));
    return;
  }
  // express.json() rejects a malformed body with a SyntaxError carrying status 400.
  if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
    res.status(400).json(toBody(ErrorCode.VALIDATION_ERROR, "Request body is not valid JSON."));
    return;
  }
  console.error(err);
  res.status(500).json(toBody(ErrorCode.INTERNAL_ERROR, "Something went wrong. Please try again."));
}

function toBody(code: string, message: string, details?: unknown): ErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}
