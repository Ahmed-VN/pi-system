/*
  Warnings:

  - You are about to drop the column `purchaseRequestId` on the `assets` table. All the data in the column will be lost.
  - You are about to drop the column `vendorId` on the `assets` table. All the data in the column will be lost.
  - You are about to drop the column `checklistKey` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseRequestId` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the `goods_receipts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payment_release_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchase_committee_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purchase_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vendors` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_purchaseRequestId_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_purchaseRequestId_fkey";

-- DropForeignKey
ALTER TABLE "goods_receipts" DROP CONSTRAINT "goods_receipts_purchaseRequestId_fkey";

-- DropForeignKey
ALTER TABLE "payment_release_requests" DROP CONSTRAINT "payment_release_requests_expenditureId_fkey";

-- DropForeignKey
ALTER TABLE "payment_release_requests" DROP CONSTRAINT "payment_release_requests_purchaseRequestId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_committee_reports" DROP CONSTRAINT "purchase_committee_reports_purchaseRequestId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_budgetHeadId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_indenterId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_projectId_fkey";

-- DropForeignKey
ALTER TABLE "purchase_requests" DROP CONSTRAINT "purchase_requests_vendorId_fkey";

-- DropIndex
DROP INDEX "assets_purchaseRequestId_key";

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "purchaseRequestId",
DROP COLUMN "vendorId";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "checklistKey",
DROP COLUMN "purchaseRequestId",
ADD COLUMN     "procurementRequestId" TEXT;

-- DropTable
DROP TABLE "goods_receipts";

-- DropTable
DROP TABLE "payment_release_requests";

-- DropTable
DROP TABLE "purchase_committee_reports";

-- DropTable
DROP TABLE "purchase_requests";

-- DropTable
DROP TABLE "vendors";

-- DropEnum
DROP TYPE "ApprovalTier";

-- DropEnum
DROP TYPE "GeMRoute";

-- DropEnum
DROP TYPE "PurchaseOrigin";

-- DropEnum
DROP TYPE "PurchaseStatus";

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetHeadId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(15,2) NOT NULL,
    "justification" TEXT NOT NULL,
    "sourcingType" "SourcingType" NOT NULL DEFAULT 'NON_GEM',
    "vendorName" TEXT,
    "vendorAddress" TEXT,
    "vendorGst" TEXT,
    "quoteReference" TEXT,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_requests_projectId_idx" ON "procurement_requests"("projectId");

-- CreateIndex
CREATE INDEX "procurement_requests_status_idx" ON "procurement_requests"("status");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_procurementRequestId_fkey" FOREIGN KEY ("procurementRequestId") REFERENCES "procurement_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_budgetHeadId_fkey" FOREIGN KEY ("budgetHeadId") REFERENCES "budget_heads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
