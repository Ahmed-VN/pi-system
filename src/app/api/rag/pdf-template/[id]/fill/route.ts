// src/app/api/rag/pdf-template/[id]/fill/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { queryDocuments } from "@/lib/rag";
import fs from "fs";

const prisma = new PrismaClient();
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const projectId = body.projectId as string | undefined;
    const streamProgress = body.streamProgress as boolean | undefined;

    const template = await prisma.pdfTemplate.findUnique({
      where: { id },
      include: { fields: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    if (template.fields.length === 0) {
      return NextResponse.json(
        { error: "This template has no mapped fields yet. Map fields first." },
        { status: 400 }
      );
    }

    const effectiveProjectId = projectId || template.projectId;
    const pdfBytes = fs.readFileSync(template.filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = template.fields.length;

    // ── Streaming mode: send progress as SSE, then base64 PDF at the end ──
    if (streamProgress) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          function send(data: object) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }

          let filledCount = 0;
          for (let i = 0; i < template.fields.length; i++) {
            const field = template.fields[i];
            send({ type: "progress", current: i + 1, total, fieldName: field.fieldName });

            try {
              const answer = await queryDocuments(effectiveProjectId, field.fieldName);
              if (answer.includes("No documents ingested") || answer.includes("Information not found")) continue;

              const pageIndex = Math.max(0, field.page - 1);
              const page = pages[pageIndex];
              if (!page) continue;

              const { width: pageWidth } = page.getSize();
              const text = answer.trim().slice(0, 300);
              const fontSize = field.fontSize;
              const availableWidth = pageWidth - field.x - 30;
              const maxWidth = Math.max(availableWidth, 100);
              const lineHeight = fontSize + 3;
              const baseY = field.y - fontSize;

              const words = text.split(" ");
              let line = "";
              let yOffset = 0;
              for (const word of words) {
                const testLine = line ? `${line} ${word}` : word;
                if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && line) {
                  page.drawText(line, { x: field.x, y: baseY - yOffset, size: fontSize, font, color: rgb(0, 0, 0) });
                  line = word;
                  yOffset += lineHeight;
                  if (yOffset > lineHeight * 3) break;
                } else {
                  line = testLine;
                }
              }
              if (line) {
                page.drawText(line, { x: field.x, y: baseY - yOffset, size: fontSize, font, color: rgb(0, 0, 0) });
              }
              filledCount++;
            } catch {
              continue;
            }
          }

          if (filledCount === 0) {
            send({ type: "error", message: "No fields could be filled. Make sure documents are ingested for this project." });
            controller.close();
            return;
          }

          const filledBytes = await pdfDoc.save();
          const base64 = Buffer.from(filledBytes).toString("base64");
          send({ type: "done", base64, fileName: `filled_${template.name}.pdf`, filledCount, total });
          controller.close();
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // ── Non-streaming fallback (same logic, no progress) ──
    let filledCount = 0;
    for (const field of template.fields) {
      try {
        const answer = await queryDocuments(effectiveProjectId, field.fieldName);
        if (answer.includes("No documents ingested") || answer.includes("Information not found")) continue;

        const pageIndex = Math.max(0, field.page - 1);
        const page = pages[pageIndex];
        if (!page) continue;

        const { width: pageWidth } = page.getSize();
        const text = answer.trim().slice(0, 300);
        const fontSize = field.fontSize;
        const availableWidth = pageWidth - field.x - 30;
        const maxWidth = Math.max(availableWidth, 100);
        const lineHeight = fontSize + 3;
        const baseY = field.y - fontSize;

        const words = text.split(" ");
        let line = "";
        let yOffset = 0;
        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && line) {
            page.drawText(line, { x: field.x, y: baseY - yOffset, size: fontSize, font, color: rgb(0, 0, 0) });
            line = word;
            yOffset += lineHeight;
            if (yOffset > lineHeight * 3) break;
          } else {
            line = testLine;
          }
        }
        if (line) {
          page.drawText(line, { x: field.x, y: baseY - yOffset, size: fontSize, font, color: rgb(0, 0, 0) });
        }
        filledCount++;
      } catch {
        continue;
      }
    }

    if (filledCount === 0) {
      return NextResponse.json(
        { error: "No fields could be filled. Make sure documents are ingested for this project in the AI Assistant tab." },
        { status: 400 }
      );
    }

    const filledBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(filledBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="filled_${template.name}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[pdf-template/:id/fill]", err);
    return NextResponse.json({ error: "Failed to fill template." }, { status: 500 });
  }
}