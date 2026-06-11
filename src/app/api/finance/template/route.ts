// src/app/api/finance/template/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { budgetHeads: { orderBy: { headName: "asc" } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const wb = new ExcelJS.Workbook();
    wb.creator = "ResearchPilot";
    wb.created = new Date();

    // ── Instructions sheet ──────────────────────────────────────────────────
    const infoSheet = wb.addWorksheet("Instructions");
    infoSheet.columns = [{ width: 80 }];

    const addInfo = (text: string, bold = false, size = 11) => {
      const row = infoSheet.addRow([text]);
      row.getCell(1).font = { bold, size, name: "Arial" };
    };

    addInfo("ResearchPilot — Expenditure Import Template", true, 14);
    infoSheet.addRow([]);
    addInfo("HOW TO USE THIS TEMPLATE:", true, 11);
    addInfo("1. Go to the 'Expenditures' sheet and fill in your expense data.");
    addInfo("2. Column A (Budget Head): Use exact names from the project, OR enter a new name.");
    addInfo("   → New budget heads will be auto-created with ₹0 allocated amount.");
    addInfo("3. Column B (Category): Enter RECURRING or NON_RECURRING (only for NEW budget heads).");
    addInfo("   → Existing budget heads already have a category; this column is ignored for them.");
    addInfo("4. Column C (Amount): Enter a positive number. Do NOT include ₹ symbol or commas.");
    addInfo("5. Column D (Description): Required. Brief note about the expenditure.");
    addInfo("6. Column E (Date): Format as YYYY-MM-DD (e.g. 2026-05-15).");
    addInfo("7. Column F (Invoice No): Optional.");
    addInfo("8. Column G (Vendor): Optional.");
    infoSheet.addRow([]);
    addInfo("EXISTING BUDGET HEADS FOR THIS PROJECT:", true, 11);
    project.budgetHeads.forEach((bh) => {
      addInfo(
        `  • ${bh.headName}  [${bh.category}]  — ₹${Number(bh.allocatedAmount).toLocaleString("en-IN")} allocated`
      );
    });
    if (project.budgetHeads.length === 0) addInfo("  (No budget heads defined yet)");

    // ── Expenditures sheet ──────────────────────────────────────────────────
    const ws = wb.addWorksheet("Expenditures");

    ws.columns = [
      { header: "Budget Head *", key: "budgetHead", width: 22 },
      { header: "Category (new heads only)", key: "category", width: 26 },
      { header: "Amount (₹) *", key: "amount", width: 16 },
      { header: "Description *", key: "description", width: 34 },
      { header: "Date * (YYYY-MM-DD)", key: "date", width: 22 },
      { header: "Invoice No", key: "invoiceNo", width: 18 },
      { header: "Vendor", key: "vendor", width: 22 },
    ];

    // Header styling
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, name: "Arial", size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      };
    });
    headerRow.height = 28;

    // Budget head dropdown validation (existing heads)
    const budgetHeadNames = project.budgetHeads.map((bh) => bh.headName);

    // Add 3 example rows
    const today = new Date().toISOString().split("T")[0];
    const exampleHead = budgetHeadNames[0] ?? "Manpower";
    const examples = [
      [exampleHead, "", "25000", "Monthly stipend payment", today, "INV-001", "Example Vendor"],
      [budgetHeadNames[1] ?? "Consumables", "", "8500", "Lab chemicals purchase", today, "", ""],
      ["New Budget Head Example", "RECURRING", "5000", "Example for new head", today, "", ""],
    ];

    examples.forEach((ex, i) => {
      const row = ws.addRow(ex);
      row.eachCell((cell) => {
        cell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF6B7280" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      });
      // Mark as example
      row.getCell(4).value = `[EXAMPLE ${i + 1} — DELETE THIS ROW] ${ex[3]}`;
    });

    // Add data validation for category column
    for (let r = 2; r <= 500; r++) {
      ws.getCell(`B${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"RECURRING,NON_RECURRING"'],
        showErrorMessage: true,
        errorTitle: "Invalid Category",
        error: "Please select RECURRING or NON_RECURRING",
      };
    }

    // Freeze header
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    // ── Serialize ────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();

    const safeName = project.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="expenditure_template_${safeName}.xlsx"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}