-- CreateEnum
CREATE TYPE "SourcingType" AS ENUM ('GEM', 'NON_GEM', 'PROPRIETARY');

-- CreateEnum
CREATE TYPE "ApprovalTier" AS ENUM ('NO_QUOTATION', 'LOCAL_COMMITTEE', 'LIMITED_TENDER', 'ADVERTISED_TENDER');

-- CreateEnum
CREATE TYPE "GeMRoute" AS ENUM ('NOT_APPLICABLE', 'DIRECT_ANY_SELLER', 'LOWEST_OF_THREE', 'REVERSE_AUCTION');

-- CreateEnum
CREATE TYPE "PurchaseOrigin" AS ENUM ('DEPARTMENT_LEVEL', 'RC_OFFICE');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'SANCTIONED', 'SOURCING', 'EVALUATED', 'ORDERED', 'RECEIVED', 'PAYMENT_PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "checklistKey" TEXT,
ADD COLUMN     "purchaseRequestId" TEXT;

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstNumber" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "bankAccountNo" TEXT,
    "bankIFSC" TEXT,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetHeadId" TEXT NOT NULL,
    "indenterId" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "specification" TEXT,
    "estimatedAmount" DECIMAL(15,2) NOT NULL,
    "sourcingType" "SourcingType" NOT NULL,
    "approvalTier" "ApprovalTier" NOT NULL,
    "gemRoute" "GeMRoute" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "purchaseOrigin" "PurchaseOrigin",
    "vendorId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_committee_reports" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "vendorsCompared" INTEGER NOT NULL,
    "recommendedVendorId" TEXT NOT NULL,
    "recommendedAmount" DECIMAL(15,2) NOT NULL,
    "priceReasonableness" TEXT NOT NULL,
    "committeeMembers" TEXT NOT NULL,
    "hodApprovalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_committee_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "installationDate" TIMESTAMP(3),
    "condition" TEXT NOT NULL,
    "installationReportNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_release_requests" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceAmount" DECIMAL(15,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "checklistComplete" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "expenditureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_release_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "purchaseAmount" DECIMAL(15,2) NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "purchase_requests_projectId_idx" ON "purchase_requests"("projectId");

-- CreateIndex
CREATE INDEX "purchase_requests_budgetHeadId_idx" ON "purchase_requests"("budgetHeadId");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_committee_reports_purchaseRequestId_key" ON "purchase_committee_reports"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_purchaseRequestId_key" ON "goods_receipts"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_release_requests_purchaseRequestId_key" ON "payment_release_requests"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_release_requests_expenditureId_key" ON "payment_release_requests"("expenditureId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_purchaseRequestId_key" ON "assets"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "assets_projectId_idx" ON "assets"("projectId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_budgetHeadId_fkey" FOREIGN KEY ("budgetHeadId") REFERENCES "budget_heads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_indenterId_fkey" FOREIGN KEY ("indenterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_committee_reports" ADD CONSTRAINT "purchase_committee_reports_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_release_requests" ADD CONSTRAINT "payment_release_requests_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_release_requests" ADD CONSTRAINT "payment_release_requests_expenditureId_fkey" FOREIGN KEY ("expenditureId") REFERENCES "expenditures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
