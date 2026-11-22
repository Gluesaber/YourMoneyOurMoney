-- F-06 Custom account & category management (docs/sprints/sprint-2/F-06-account-management.md §4).

-- AlterTable: null = active (BR-16). Existing accounts stay active.
ALTER TABLE "Account" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- F-06 R3: account names are unique per user ignoring case. Names are stored trimmed by the API, so
-- lower("name") is enough. Written by hand because Prisma cannot declare an expression index; like the
-- CHECK constraints in add_financial_tables, later migrations must leave it in place.
CREATE UNIQUE INDEX "Account_userId_lower_name_key" ON "Account" ("userId", lower("name"));
