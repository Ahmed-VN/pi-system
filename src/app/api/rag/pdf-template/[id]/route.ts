// src/app/api/rag/pdf-template/[id]/route.ts
// Handles: get one template + its PDF for the mapper UI (GET),
//          save field coordinates (PUT), delete template (DELETE)

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.pdfTemplate.findUnique({
      where: { id },
      include: { fields: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (err) {
    console.error("[pdf-template/:id GET]", err);
    return NextResponse.json({ error: "Failed to fetch template." }, { status: 500 });
  }
}

// Serve the raw PDF bytes for rendering in the mapper UI
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.pdfTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(template.filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (err) {
    console.error("[pdf-template/:id file]", err);
    return NextResponse.json({ error: "Failed to load PDF file." }, { status: 500 });
  }
}

// Save / replace all field mappings for a template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { fields } = body as {
      fields: Array<{
        fieldName: string;
        page: number;
        x: number;
        y: number;
        width?: number;
        fontSize?: number;
      }>;
    };

    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: "fields array is required." }, { status: 400 });
    }

    // Replace all existing fields for this template
    await prisma.templateField.deleteMany({ where: { templateId: id } });

    await prisma.templateField.createMany({
      data: fields.map((f) => ({
        templateId: id,
        fieldName: f.fieldName,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width ?? 150,
        fontSize: f.fontSize ?? 9,
      })),
    });

    const updated = await prisma.pdfTemplate.findUnique({
      where: { id },
      include: { fields: true },
    });

    return NextResponse.json({ template: updated });
  } catch (err) {
    console.error("[pdf-template/:id PUT]", err);
    return NextResponse.json({ error: "Failed to save field mappings." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await prisma.pdfTemplate.findUnique({ where: { id } });

    if (template) {
      try {
        fs.unlinkSync(template.filePath);
      } catch {
        // file already gone, ignore
      }
    }

    await prisma.pdfTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[pdf-template/:id DELETE]", err);
    return NextResponse.json({ error: "Failed to delete template." }, { status: 500 });
  }
}