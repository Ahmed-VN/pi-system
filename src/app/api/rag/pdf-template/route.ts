// src/app/api/rag/pdf-template/route.ts
// Handles: upload a new flat PDF template (POST), list templates for a project (GET)

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const TEMPLATE_DIR = "./uploaded_templates";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const name = formData.get("name") as string | null;

    if (!file || !projectId || !name) {
      return NextResponse.json(
        { error: "file, projectId and name are required." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const projectDir = path.join(TEMPLATE_DIR, projectId.replace(/[^a-zA-Z0-9_-]/g, "_"));
    fs.mkdirSync(projectDir, { recursive: true });

    const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(projectDir, safeFileName);

    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    // Get page count using pdf-lib
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();

    const template = await prisma.pdfTemplate.create({
      data: {
        projectId,
        name,
        filePath,
        fileSize: file.size,
        pageCount,
      },
    });

    return NextResponse.json({ template });
  } catch (err) {
    console.error("[pdf-template POST]", err);
    return NextResponse.json({ error: "Failed to upload template." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const templates = await prisma.pdfTemplate.findMany({
      where: { projectId },
      include: { fields: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[pdf-template GET]", err);
    return NextResponse.json({ error: "Failed to fetch templates." }, { status: 500 });
  }
}