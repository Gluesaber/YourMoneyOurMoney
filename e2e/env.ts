// Where the E2E run's own servers and database live — separate from the dev servers (3000 / 5173) and
// the dev database, so `npm run test:e2e` can run while you develop and never sees your dev data.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://ymom:ymom@localhost:5434/ymom_e2e?schema=public";
export const E2E_API_PORT = 3100;
export const E2E_CLIENT_PORT = 5174;
