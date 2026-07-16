-- CreateEnum
CREATE TYPE "BankName" AS ENUM ('CANARA', 'SBI');

-- CreateEnum
CREATE TYPE "ParsingStatus" AS ENUM ('PENDING', 'PARSED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('INTEREST', 'GRANT', 'BANK_CHARGE', 'TAX', 'REFUND', 'EXPENDITURE', 'UNCATEGORIZED');

-- CreateEnum
CREATE TYPE "AllocationMethod" AS ENUM ('PRO_RATA_BALANCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('EXACT', 'LIKELY', 'UNCERTAIN', 'UNMATCHED');

-- AlterTable
ALTER TABLE "grant_releases" ADD COLUMN     "nonRecurringAmount" DECIMAL(15,2),
ADD COLUMN     "recurringAmount" DECIMAL(15,2),
ADD COLUMN     "utr" TEXT;

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bankName" "BankName" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "statementPeriodStart" TIMESTAMP(3) NOT NULL,
    "statementPeriodEnd" TIMESTAMP(3) NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalFileUrl" TEXT NOT NULL,
    "parsingStatus" "ParsingStatus" NOT NULL DEFAULT 'PENDING',
    "parsingErrors" TEXT,
    "openingBalance" DECIMAL(15,2),
    "closingBalance" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "narration" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "debit" DECIMAL(15,2),
    "credit" DECIMAL(15,2),
    "balance" DECIMAL(15,2) NOT NULL,
    "category" "TransactionCategory" NOT NULL DEFAULT 'UNCATEGORIZED',
    "matchedExpenditureId" TEXT,
    "matchConfidence" "MatchConfidence",
    "recurringShare" DECIMAL(15,2),
    "nonRecurringShare" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_allocations" (
    "id" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "recurringInterest" DECIMAL(15,2) NOT NULL,
    "nonRecurringInterest" DECIMAL(15,2) NOT NULL,
    "recurringBalanceBefore" DECIMAL(15,2) NOT NULL,
    "nonRecurringBalanceBefore" DECIMAL(15,2) NOT NULL,
    "allocationMethod" "AllocationMethod" NOT NULL DEFAULT 'PRO_RATA_BALANCE',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "formulaUsed" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statements_projectId_idx" ON "bank_statements"("projectId");

-- CreateIndex
CREATE INDEX "bank_transactions_statementId_idx" ON "bank_transactions"("statementId");

-- CreateIndex
CREATE INDEX "bank_transactions_projectId_idx" ON "bank_transactions"("projectId");

-- CreateIndex
CREATE INDEX "bank_transactions_category_idx" ON "bank_transactions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "interest_allocations_bankTransactionId_key" ON "interest_allocations"("bankTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "categorization_rules_keyword_key" ON "categorization_rules"("keyword");

-- CreateIndex
CREATE INDEX "categorization_rules_isActive_idx" ON "categorization_rules"("isActive");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_idx" ON "audit_logs"("projectId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedExpenditureId_fkey" FOREIGN KEY ("matchedExpenditureId") REFERENCES "expenditures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_allocations" ADD CONSTRAINT "interest_allocations_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
