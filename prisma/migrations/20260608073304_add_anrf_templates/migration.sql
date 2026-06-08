-- CreateTable
CREATE TABLE "anrf_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "fileType" TEXT NOT NULL DEFAULT 'other',
    "fileSize" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "anrf_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "anrf_templates" ADD CONSTRAINT "anrf_templates_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
