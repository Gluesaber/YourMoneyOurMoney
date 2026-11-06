// Command-line wrapper around resetDb() for the Playwright E2E setup (e2e/globalSetup.ts), which runs it
// against the E2E database: `DATABASE_URL=… npx tsx test/helpers/reset-db.cli.ts`.
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "./db.js";

try {
  await resetDb();
  console.log(`Reset and seeded ${new URL(process.env.DATABASE_URL ?? "").pathname.slice(1)}.`);
} finally {
  await getPrisma().$disconnect();
}
