import type { CurrentUser } from "./currentUser.js";

// Integration point 1: the session stores the user's id and login timestamp (for 24h absolute expiry).
declare module "express-session" {
  interface SessionData {
    userId: number;
    loginAt?: number;
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
