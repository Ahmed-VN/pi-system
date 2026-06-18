// src/app/api/finance/export/excel/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

const INR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const DARK = "FF1A1A2E";
const ACCENT = "FF4F46E5";
const LIGHT_BLUE = "FFE0E7FF";
const LIGHT_GRAY = "FFF9FAFB";
const WHITE = "FFFFFFFF";
const BORDER_COLOR = "FFD1D5DB";

function applyBorder(cell: ExcelJS.Cell) {
  const b = { style: "thin" as const, color: { argb: BORDER_COLOR } };
  cell.border = { top: b, left: b, bottom: b, right: b };
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        budgetHeads: {
          include: { expenditures: { orderBy: { expenditureDate: "asc" } } },
          orderBy: { headName: "asc" },
        },
        pi: { select: { name: true, institution: true, designation: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const wb = new ExcelJS.Workbook();
    wb.creator = "ResearchPilot";
    wb.created = new Date();

    // ═══════════════════════════════════════════════════════════════
    // SHEET 1 — SUMMARY
    // ═══════════════════════════════════════════════════════════════
    const summary = wb.addWorksheet("Summary");
    summary.views = [{ showGridLines: false }];

    const addSummaryHeader = (text: string, row: number, merge: string) => {
      const r = summary.getRow(row);
      r.height = 32;
      const cell = summary.getCell(`A${row}`);
      cell.value = text;
      cell.font = { bold: true, size: 14, name: "Arial", color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      summary.mergeCells(merge);
    };

    // Title block
    summary.columns = [
      { width: 30 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 18 },
    ];

    addSummaryHeader("ResearchPilot — Budget Summary Report", 1, "A1:F1");

    // Project meta
    const metaData = [
      ["Project", project.title],
      ["Grant Type", project.grantType],
      ["Sanction No.", project.sanctionNumber],
      ["PI", project.pi.name],
      ["Institution", project.pi.institution ?? "—"],
      ["Period", `${project.startDate.toLocaleDateString("en-IN")} — ${project.endDate.toLocaleDateString("en-IN")}`],
      ["Total Budget", INR(Number(project.totalBudget))],
      ["Report Generated", new Date().toLocaleDateString("en-IN", { dateStyle: "long" })],
    ];

    let currentRow = 2;
    metaData.forEach(([label, value]) => {
      const row = summary.getRow(currentRow);
      row.height = 20;
      const labelCell = summary.getCell(`A${currentRow}`);
      labelCell.value = label;
      labelCell.font = { bold: true, name: "Arial", size: 10, color: { argb: "FF374151" } };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
      labelCell.alignment = { vertical: "middle" };
      applyBorder(labelCell);

      const valCell = summary.getCell(`B${currentRow}`);
      valCell.value = value;
      valCell.font = { name: "Arial", size: 10 };
      valCell.alignment = { vertical: "middle" };
      applyBorder(valCell);
      summary.mergeCells(`B${currentRow}:F${currentRow}`);
      currentRow++;
    });

    currentRow++;

    // Budget head summary table header
    const tableHeaderRow = summary.getRow(currentRow);
    tableHeaderRow.height = 26;
    const summaryHeaders = ["Budget Head", "Category", "Allocated (₹)", "Spent (₹)", "Balance (₹)", "% Used"];
    summaryHeaders.forEach((h, i) => {
      const col = String.fromCharCode(65 + i);
      const cell = summary.getCell(`${col}${currentRow}`);
      cell.value = h;
      cell.font = { bold: true, name: "Arial", size: 10, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      applyBorder(cell);
    });
    currentRow++;

    const tableStart = currentRow;
    let totalAllocated = 0;
    let totalSpent = 0;

    project.budgetHeads.forEach((bh, idx) => {
      const spent = bh.expenditures.reduce((s, e) => s + Number(e.amount), 0);
      const allocated = Number(bh.allocatedAmount);
      const balance = allocated - spent;
      const pct = allocated > 0 ? ((spent / allocated) * 100).toFixed(1) + "%" : "—";

      totalAllocated += allocated;
      totalSpent += spent;

      const row = summary.getRow(currentRow);
      row.height = 20;
      const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;

      const values = [bh.headName, bh.category === "NON_RECURRING" ? "Non-Recurring" : "Recurring",
        allocated, spent, balance, pct];

      values.forEach((v, i) => {
        const col = String.fromCharCode(65 + i);
        const cell = summary.getCell(`${col}${currentRow}`);
        cell.value = v;
        cell.font = { name: "Arial", size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle" };
        applyBorder(cell);
        if (i >= 2 && i <= 4 && typeof v === "number") {
          cell.numFmt = '₹#,##0.00';
          if (i === 4 && v < 0) cell.font = { name: "Arial", size: 10, color: { argb: "FFDC2626" } };
        }
      });
      currentRow++;
    });

    // Total row
    const totalRow = summary.getRow(currentRow);
    totalRow.height = 24;
    const totals = ["TOTAL", "", totalAllocated, totalSpent, totalAllocated - totalSpent,
      totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) + "%" : "—"];
    totals.forEach((v, i) => {
      const col = String.fromCharCode(65 + i);
      const cell = summary.getCell(`${col}${currentRow}`);
      cell.value = v;
      cell.font = { bold: true, name: "Arial", size: 10, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      cell.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle" };
      applyBorder(cell);
      if (i >= 2 && i <= 4 && typeof v === "number") cell.numFmt = '₹#,##0.00';
    });

    // ═══════════════════════════════════════════════════════════════
    // SHEET 2 — EXPENDITURE DETAIL
    // ═══════════════════════════════════════════════════════════════
    const detail = wb.addWorksheet("Expenditure Detail");
    detail.views = [{ showGridLines: false }];
    detail.columns = [
      { width: 6 }, { width: 26 }, { width: 20 }, { width: 38 }, { width: 18 }, { width: 18 }, { width: 22 },
    ];

    // Title
    const detailTitle = detail.getRow(1);
    detailTitle.height = 32;
    const dtCell = detail.getCell("A1");
    dtCell.value = "Expenditure Detail Ledger — " + project.title;
    dtCell.font = { bold: true, size: 13, name: "Arial", color: { argb: WHITE } };
    dtCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    dtCell.alignment = { horizontal: "center", vertical: "middle" };
    detail.mergeCells("A1:G1");

    // Column headers
    const detailHeaders = ["#", "Budget Head", "Date", "Description", "Invoice No.", "Vendor", "Amount (₹)"];
    const dhr = detail.getRow(2);
    dhr.height = 24;
    detailHeaders.forEach((h, i) => {
      const cell = dhr.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, name: "Arial", size: 10, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
      cell.alignment = { horizontal: i === 6 ? "right" : "center", vertical: "middle" };
      applyBorder(cell);
    });
    detail.views = [{ state: "frozen", xSplit: 0, ySplit: 2, showGridLines: false }];

    // All expenditures sorted by date
    const allExpenditures = project.budgetHeads
      .flatMap((bh) => bh.expenditures.map((e) => ({ ...e, headName: bh.headName })))
      .sort((a, b) => a.expenditureDate.getTime() - b.expenditureDate.getTime());

    let detailRow = 3;
    allExpenditures.forEach((e, idx) => {
      const row = detail.getRow(detailRow);
      row.height = 20;
      const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;

      const cells = [
        idx + 1,
        e.headName,
        e.expenditureDate.toLocaleDateString("en-IN"),
        e.description,
        e.voucherNumber ?? "—",
        "—", // vendor not in schema
        Number(e.amount),
      ];

      cells.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = { name: "Arial", size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.alignment = { horizontal: i === 6 ? "right" : i === 0 ? "center" : "left", vertical: "middle", wrapText: i === 3 };
        applyBorder(cell);
        if (i === 6) cell.numFmt = '₹#,##0.00';
      });
      detailRow++;
    });

    // Grand total row in detail
    const gtr = detail.getRow(detailRow);
    gtr.height = 24;
    detail.mergeCells(`A${detailRow}:F${detailRow}`);
    const gtLabel = gtr.getCell(1);
    gtLabel.value = "GRAND TOTAL";
    gtLabel.font = { bold: true, name: "Arial", size: 10, color: { argb: WHITE } };
    gtLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    gtLabel.alignment = { horizontal: "right", vertical: "middle" };
    applyBorder(gtLabel);

    const gtAmt = gtr.getCell(7);
    gtAmt.value = totalSpent;
    gtAmt.numFmt = '₹#,##0.00';
    gtAmt.font = { bold: true, name: "Arial", size: 10, color: { argb: WHITE } };
    gtAmt.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    gtAmt.alignment = { horizontal: "right", vertical: "middle" };
    applyBorder(gtAmt);

    // Serialize
    const buffer = await wb.xlsx.writeBuffer();
    const safeName = project.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="finance_export_${safeName}.xlsx"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}