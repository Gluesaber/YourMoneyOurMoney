import { execSync } from "node:child_process";
import { E2E_DATABASE_URL } from "./env.js";

// Runs once before the E2E suite: brings the dedicated E2E database to the latest migration (Prisma
// creates it if it does not exist yet), then empties it and re-seeds the demo users and accounts. Every run
// therefore starts from the same known state, and the dev database is never touched.
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  execSync("npx prisma migrate deploy", { cwd: "server", env, stdio: "inherit" });
  execSync("npx tsx test/helpers/reset-db.cli.ts", { cwd: "server", env, stdio: "inherit" });
}
