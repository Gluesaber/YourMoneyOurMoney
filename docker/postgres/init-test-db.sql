-- Runs once, when the db-data volume is first created. The server test suite uses ymom_test
-- (see server/vitest.config.ts) so tests never touch dev data.
CREATE DATABASE ymom_test OWNER ymom;
-- The Playwright E2E suite uses its own database (see e2e/env.ts). On a volume created before this line
-- existed, e2e/globalSetup.ts creates it instead.
CREATE DATABASE ymom_e2e OWNER ymom;
