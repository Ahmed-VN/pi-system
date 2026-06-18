import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const documents = await prisma.document.findMany({
      where: {
        uploadedById: session.user.id,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { title: true, sanctionNumber: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Documents GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const documentType = formData.get("documentType") as string;
    const projectId = formData.get("projectId") as string;
    const expiryDateRaw = formData.get("expiryDate") as string | null;

    if (!file || !title || !documentType || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB" }, { status: 400 });
    }

    // Allow PI or CO_PI to upload documents
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
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
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

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
    title,
    documentType: documentType as any,
    fileUrl,
    fileSize: file.size,
    mimeType: file.type,
    projectId,
    uploadedById: session.user.id,
    expiryDate: expiryDateRaw ? new Date(expiryDateRaw) : null,
  },
});

    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: "Document Uploaded",
        message: `"${title}" has been uploaded successfully to ${project.title}.`,
        type: "SUCCESS",
        link: `/dashboard/documents`,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Documents POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}