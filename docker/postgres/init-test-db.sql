-- Runs once, when the db-data volume is first created. The test suite uses this database
-- (see server/vitest.config.ts) so tests never touch dev data.
CREATE DATABASE ymom_test OWNER ymom;
