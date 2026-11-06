import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgSession = connectPgSimple(session);

export const SESSION_COOKIE_NAME = "ymom.sid";
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Shared by the session cookie and logout's clearCookie: a browser only removes a cookie when the clearing
// Set-Cookie has the same name, path and attributes.
export function sessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

// Sessions live in Postgres (connect-pg-simple), so a server restart does not log everyone out.
// The "session" table is created by the Prisma migrations (model Session), not by the library.
// HTTP-only, SameSite=Lax cookie; Secure only in production. The client is same-origin in dev
// through client/vite.config.ts's /api proxy. S1-04 documents the full lifecycle.
export function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Copy server/.env.example to server/.env and set one.");
  }
  const conString = process.env.DATABASE_URL;
  if (!conString) {
    throw new Error("DATABASE_URL is not set. Copy server/.env.example to server/.env and set one.");
  }

  return session({
    store: new PgSession({ conString, tableName: "session", createTableIfMissing: false }),
    name: SESSION_COOKIE_NAME,
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: { ...sessionCookieOptions(), maxAge: SESSION_MAX_AGE_MS },
  });
}
