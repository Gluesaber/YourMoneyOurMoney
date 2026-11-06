import { AppError, ErrorCode } from "./errors.js";

// Integration point 4 (BR-04). A record that does not exist and a record owned by someone else
// give the same 404, so a user cannot tell whether another user's record exists.
export function assertOwned<T extends { userId: number }>(record: T | null, userId: number): T {
  if (!record || record.userId !== userId) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Not found.");
  }
  return record;
}
