// src/app/api/finance/import/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

interface ImportRow {
  rowNumber: number;
  budgetHeadName: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  invoiceNo?: string;
  vendor?: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { budgetHeads: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

   const arrayBuffer = await file.arrayBuffer();
const wb = new ExcelJS.Workbook();
// @ts-expect-error ExcelJS types are incorrect, Buffer works at runtime
await wb.xlsx.load(Buffer.from(arrayBuffer));

    const ws = wb.getWorksheet("Expenditures");
    if (!ws) {
      return NextResponse.json(
        { error: "Sheet 'Expenditures' not found. Please use the official template." },
        { status: 400 }
      );
    }

    // Parse rows (skip header row 1, skip example rows)
    const parsedRows: ImportRow[] = [];
    const errors: ImportError[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const budgetHeadRaw = String(row.getCell(1).value ?? "").trim();
      const categoryRaw = String(row.getCell(2).value ?? "").trim().toUpperCase();
      const amountRaw = row.getCell(3).value;
      const descriptionRaw = String(row.getCell(4).value ?? "").trim();
      const dateRaw = row.getCell(5).value;
      const invoiceNoRaw = String(row.getCell(6).value ?? "").trim() || undefined;
      const vendorRaw = String(row.getCell(7).value ?? "").trim() || undefined;

      // Skip completely empty rows
      if (!budgetHeadRaw && !amountRaw && !descriptionRaw) return;

      // Skip example rows
      if (descriptionRaw.includes("[EXAMPLE")) return;

      // Validate budget head
      if (!budgetHeadRaw) {
        errors.push({ row: rowNumber, field: "Budget Head", message: "Budget Head is required" });
        return;
      }

      // Validate amount
      const amount = Number(amountRaw);
      if (!amountRaw || isNaN(amount) || amount <= 0) {
        errors.push({ row: rowNumber, field: "Amount", message: "Amount must be a positive number" });
        return;
      }

      // Validate description
      if (!descriptionRaw) {
        errors.push({ row: rowNumber, field: "Description", message: "Description is required" });
        return;
      }

      // Validate date
      let parsedDate: Date;
      if (dateRaw instanceof Date) {
        parsedDate = dateRaw;
      } else {
        parsedDate = new Date(String(dateRaw));
      }
      if (isNaN(parsedDate.getTime())) {
        errors.push({ row: rowNumber, field: "Date", message: `Invalid date: "${dateRaw}". Use YYYY-MM-DD format` });
        return;
      }

      // Validate category for new budget heads
      const existingHead = project.budgetHeads.find(
        (bh) => bh.headName.toLowerCase() === budgetHeadRaw.toLowerCase()
      );
      const isNew = !existingHead;
      if (isNew && categoryRaw && !["RECURRING", "NON_RECURRING"].includes(categoryRaw)) {
        errors.push({
          row: rowNumber,
          field: "Category",
          message: `Invalid category "${categoryRaw}". Use RECURRING or NON_RECURRING`,
        });
        return;
      }

      parsedRows.push({
        rowNumber,
        budgetHeadName: budgetHeadRaw,
        category: categoryRaw || "RECURRING",
        amount,
        description: descriptionRaw,
        date: parsedDate.toISOString(),
        invoiceNo: invoiceNoRaw,
        vendor: vendorRaw,
      });
    });

    if (parsedRows.length === 0 && errors.length === 0) {
      return NextResponse.json({ error: "No data rows found in the file." }, { status: 400 });
    }

    // If only errors, return without importing
    if (parsedRows.length === 0) {
      return NextResponse.json({ success: false, errors, imported: 0, newBudgetHeads: [] }, { status: 422 });
    }

    // Build a map of budget head name → id (case-insensitive match first)
    const budgetHeadMap = new Map<string, string>();
    project.budgetHeads.forEach((bh) => {
      budgetHeadMap.set(bh.headName.toLowerCase(), bh.id);
    });

    // Identify new budget heads needed
    const newHeadsNeeded = new Map<string, string>(); // name → category
    parsedRows.forEach((r) => {
      const key = r.budgetHeadName.toLowerCase();
      if (!budgetHeadMap.has(key) && !newHeadsNeeded.has(key)) {
        newHeadsNeeded.set(r.budgetHeadName, r.category);
      }
    });

    // Create new budget heads
    const createdHeads: string[] = [];
    for (const [headName, category] of newHeadsNeeded) {
      const created = await prisma.budgetHead.create({
        data: {
          projectId,
          headName,
          allocatedAmount: 0,
          category: category === "NON_RECURRING" ? "NON_RECURRING" : "RECURRING",
        },
      });
      budgetHeadMap.set(headName.toLowerCase(), created.id);
      createdHeads.push(headName);
    }

    // Insert expenditures
    const expendituresToCreate = parsedRows.map((r) => ({
      projectId,
      budgetHeadId: budgetHeadMap.get(r.budgetHeadName.toLowerCase())!,
      amount: r.amount,
      description: r.description,
      voucherNumber: r.invoiceNo ?? null,
      expenditureDate: new Date(r.date),
    }));

    await prisma.expenditure.createMany({ data: expendituresToCreate });

    return NextResponse.json({
      success: true,
      imported: expendituresToCreate.length,
      newBudgetHeads: createdHeads,
      errors,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}