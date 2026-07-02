import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getRequiredProcurementDocs, type SourcingType } from "@/lib/procurement-rules";

// GET /api/procurement/requests/[id]/documents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Next.js 16: params must be awaited

  const procurementRequest = await prisma.procurementRequest.findUnique({
    where: { id },
    select: { sourcingType: true },
  });

  if (!procurementRequest) {
    return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
  }

  const requiredDocs = getRequiredProcurementDocs(procurementRequest.sourcingType as SourcingType);

  const uploaded = await prisma.document.findMany({
    where: { procurementRequestId: id },
    select: { id: true, checklistKey: true, title: true, fileUrl: true },
  });

  const uploadedByKey = new Map(
    uploaded.filter((d) => d.checklistKey).map((d) => [d.checklistKey as string, d.id])
  );

  const checklist = requiredDocs.map((item) => ({
    type: item.key,
    label: item.label,
    uploaded: uploadedByKey.has(item.key),
    documentId: uploadedByKey.get(item.key),
  }));

  return NextResponse.json(checklist);
}

// POST /api/procurement/requests/[id]/documents
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const documentType = formData.get("documentType") as string; // this is the checklist key, e.g. "REQUISITION_FORM"

    if (!file || !documentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB" }, { status: 400 });
    }

    // Confirm the procurement request exists and the user has access to its project
    const procurementRequest = await prisma.procurementRequest.findFirst({
      where: {
        id,
        project: {
          OR: [
            { piId: session.user.id },
            {
              personnelRecords: {
                some: {
                  userId: session.user.id,
                  role: { in: ["CO_PI", "JRF"] },
                },
              },
            },
          ],
        },
      },
      select: { id: true, projectId: true },
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", session.user.id);
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${session.user.id}/${fileName}`;

    const document = await prisma.document.create({
      data: {
        title: file.name,
        documentType: "OTHER",
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        projectId: procurementRequest.projectId,
        uploadedById: session.user.id,
        procurementRequestId: procurementRequest.id,
        checklistKey: documentType,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Procurement documents POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}