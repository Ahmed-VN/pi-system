-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "procurementRequestId" TEXT;

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "procurementRequestId" TEXT NOT NULL,
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
    "procurementRequestId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceAmount" DECIMAL(15,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "checklistComplete" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "expenditureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_release_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_procurementRequestId_key" ON "goods_receipts"("procurementRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_release_requests_procurementRequestId_key" ON "payment_release_requests"("procurementRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_release_requests_expenditureId_key" ON "payment_release_requests"("expenditureId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_procurementRequestId_fkey" FOREIGN KEY ("procurementRequestId") REFERENCES "procurement_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_procurementRequestId_fkey" FOREIGN KEY ("procurementRequestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_release_requests" ADD CONSTRAINT "payment_release_requests_procurementRequestId_fkey" FOREIGN KEY ("procurementRequestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_release_requests" ADD CONSTRAINT "payment_release_requests_expenditureId_fkey" FOREIGN KEY ("expenditureId") REFERENCES "expenditures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
