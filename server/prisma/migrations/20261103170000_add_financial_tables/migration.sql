-- S1-02: financial tables, plus the session table so Prisma owns it.

-- connect-pg-simple's session table (same as node_modules/connect-pg-simple/table.sql).
-- IF NOT EXISTS because databases created before this migration already have it.
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session"("expire");

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'LOAN_GIVEN', 'LOAN_TAKEN', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountSubtype" AS ENUM ('BANK', 'WALLET', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('PAYMENT', 'RECEIVE');

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" "AccountSubtype",
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "openingDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "sourceAccountId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "note" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLine" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "TransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_id_userId_key" ON "Account"("id", "userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_idx" ON "Transaction"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_id_userId_key" ON "Transaction"("id", "userId");

-- CreateIndex
CREATE INDEX "TransactionLine_transactionId_idx" ON "TransactionLine"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionLine_accountId_idx" ON "TransactionLine"("accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sourceAccountId_userId_fkey" FOREIGN KEY ("sourceAccountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLine" ADD CONSTRAINT "TransactionLine_transactionId_userId_fkey" FOREIGN KEY ("transactionId", "userId") REFERENCES "Transaction"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLine" ADD CONSTRAINT "TransactionLine_accountId_userId_fkey" FOREIGN KEY ("accountId", "userId") REFERENCES "Account"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Business-rule CHECK constraints (docs/system-sds.md §3.3). Prisma cannot declare these in
-- schema.prisma; it does not track them, so later migrations leave them in place.

-- BR-02: amounts are positive satang.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_totalAmount_positive" CHECK ("totalAmount" > 0);
ALTER TABLE "TransactionLine" ADD CONSTRAINT "TransactionLine_amount_positive" CHECK ("amount" > 0);

-- BR-12: only CASH, LOAN_TAKEN and LOAN_GIVEN accounts carry an opening balance, and it is never negative.
ALTER TABLE "Account" ADD CONSTRAINT "Account_openingBalance_nonnegative" CHECK ("openingBalance" >= 0);
ALTER TABLE "Account" ADD CONSTRAINT "Account_openingBalance_allowed_type"
    CHECK ("openingBalance" = 0 OR "type" IN ('CASH', 'LOAN_TAKEN', 'LOAN_GIVEN'));

-- Subtype must fit the type: BANK/WALLET are CASH accounts, CREDIT_CARD is a LOAN_TAKEN account.
ALTER TABLE "Account" ADD CONSTRAINT "Account_subtype_matches_type" CHECK (
    "subtype" IS NULL
    OR ("subtype" IN ('BANK', 'WALLET') AND "type" = 'CASH')
    OR ("subtype" = 'CREDIT_CARD' AND "type" = 'LOAN_TAKEN')
);
