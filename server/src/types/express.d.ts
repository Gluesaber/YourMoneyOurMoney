import type { CurrentUser } from "./currentUser.js";

// Integration point 1: the session stores only the user's id.
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

// Integration point 2: set by requireUser.
declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export {};
