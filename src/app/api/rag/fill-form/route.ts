import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { queryDocuments } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdfFile = formData.get("pdfFile") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!pdfFile || !projectId) {
      return NextResponse.json({ error: "pdfFile and projectId are required." }, { status: 400 });
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "No form fields found. Make sure you upload a fillable PDF (with AcroForm fields), not a scanned or flat PDF." },
        { status: 400 }
      );
    }

    const fieldNames = fields.map((f: { getName: () => any; }) => f.getName());

    // Query RAG for each field sequentially (CPU-bound LLM, no point parallelizing)
    for (const fieldName of fieldNames) {
      try {
        const answer = await queryDocuments(projectId, fieldName);

        // Skip if RAG found nothing useful
        if (
          answer.includes("Information not found") ||
          answer.includes("No documents ingested")
        ) {
          continue;
        }

        const field = form.getFieldMaybe(fieldName);
        if (!field) continue;

        const fieldType = field.constructor.name;

        if (fieldType === "PDFTextField") {
          const textField = form.getTextField(fieldName);
          // Trim answer to avoid overflowing small fields
          textField.setText(answer.trim().slice(0, 500));
        } else if (fieldType === "PDFCheckBox") {
          const lower = answer.toLowerCase();
          if (lower.includes("yes") || lower.includes("true")) {
            form.getCheckBox(fieldName).check();
          }
        } else if (fieldType === "PDFDropdown") {
          const dropdown = form.getDropdown(fieldName);
          const options = dropdown.getOptions();
          // Pick the option closest to the answer
          const match = options.find((o: string) =>
            answer.toLowerCase().includes(o.toLowerCase())
          );
          if (match) dropdown.select(match);
        }
        // RadioGroups, signatures etc. — skip gracefully
      } catch {
        // Don't fail the whole request if one field errors
        continue;
      }
    }

    const filledBytes = await pdfDoc.save();
const buffer = Buffer.from(filledBytes);

return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="filled_${pdfFile.name}"`,
      },
    });
  } catch (err) {
    console.error("[fill-form]", err);
    return NextResponse.json({ error: "Failed to process PDF." }, { status: 500 });
  }
}
