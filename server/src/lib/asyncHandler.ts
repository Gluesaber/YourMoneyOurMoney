import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not forward a rejected promise to the error handler on its own.
// Wrap every async route with this so a thrown AppError reaches errorHandler.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
