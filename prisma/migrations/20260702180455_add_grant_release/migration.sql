-- CreateTable
CREATE TABLE "grant_releases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sanctionNo" TEXT NOT NULL,
    "sanctionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grant_releases_projectId_idx" ON "grant_releases"("projectId");

-- CreateIndex
CREATE INDEX "grant_releases_financialYear_idx" ON "grant_releases"("financialYear");

-- AddForeignKey
ALTER TABLE "grant_releases" ADD CONSTRAINT "grant_releases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_releases" ADD CONSTRAINT "grant_releases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
