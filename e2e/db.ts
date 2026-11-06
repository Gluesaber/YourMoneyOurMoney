import { execSync } from "node:child_process";
import { E2E_DATABASE_URL } from "./env.js";

const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };

// Creates the E2E database if missing and brings it to the latest migration. Run once, in globalSetup.
export function prepareE2eDatabase() {
  execSync("npx tsx test/helpers/ensure-db.cli.ts", { cwd: "server", env, stdio: "inherit" });
  execSync("npx prisma migrate deploy", { cwd: "server", env, stdio: "inherit" });
}

// Empties the E2E database and re-seeds the demo users and accounts. Each spec file calls it in
// test.beforeAll, so a file that fails halfway (e.g. with alice still disabled) cannot break the next one.
export function resetE2eDatabase() {
  execSync("npx tsx test/helpers/reset-db.cli.ts", { cwd: "server", env, stdio: "inherit" });
}
