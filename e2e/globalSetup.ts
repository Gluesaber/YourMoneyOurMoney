import { prepareE2eDatabase } from "./db.js";

// Runs once before the E2E suite: creates the dedicated E2E database if it does not exist and brings it to
// the latest migration. Each spec file then resets and re-seeds it (e2e/db.ts resetE2eDatabase), so every
// file starts from the same known state and the dev database is never touched.
export default function globalSetup() {
  prepareE2eDatabase();
}
