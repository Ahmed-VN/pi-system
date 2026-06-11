import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

// ── helpers ───────────────────────────────────────────────────────────────────
const INR = (n: number) =>
  "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// hex color → pdf-lib rgb()
function hex(h: string) {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// ── colors ────────────────────────────────────────────────────────────────────
const C = {
  dark:   hex("#1A1A2E"),
  accent: hex("#4F46E5"),
  light:  hex("#E0E7FF"),
  gray:   hex("#F3F4F6"),
  red:    hex("#DC2626"),
  white:  rgb(1, 1, 1),
  text:   hex("#111827"),
  muted:  hex("#6B7280"),
  subtle: hex("#9CA3AF"),
  label:  hex("#374151"),
};

// A4 dimensions in pdf-lib points (1pt = 1/72 inch)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const W      = PAGE_W - MARGIN * 2; // usable width

// ── low-level drawing helpers ─────────────────────────────────────────────────

function fillRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  color: ReturnType<typeof rgb>
) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

interface TextOpts {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  /** left-edge of the box */
  x: number;
  /** baseline y (pdf-lib = bottom-up) */
  y: number;
  maxWidth?: number;
  align?: "left" | "right" | "center";
}

function drawText(page: PDFPage, text: string, opts: TextOpts) {
  const color = opts.color ?? C.text;
  let dx = opts.x;
  if (opts.align && opts.align !== "left" && opts.maxWidth) {
    const tw = opts.font.widthOfTextAtSize(text, opts.size);
    if (opts.align === "right")  dx = opts.x + opts.maxWidth - tw;
    if (opts.align === "center") dx = opts.x + (opts.maxWidth - tw) / 2;
  }
  page.drawText(text, { x: dx, y: opts.y, size: opts.size, font: opts.font, color });
}

// Wrap text into lines that fit within maxWidth
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── page manager (handles automatic new pages) ────────────────────────────────
class PageManager {
  pages: PDFPage[] = [];
  private pdfDoc: PDFDocument;
  private fonts!: Fonts;
  curPage!: PDFPage;
  /** current Y in top-down coordinates (we convert to pdf-lib bottom-up internally) */
  y: number = MARGIN;

  constructor(pdfDoc: PDFDocument) {
    this.pdfDoc = pdfDoc;
  }

  setFonts(fonts: Fonts) { this.fonts = fonts; }

  addPage() {
    this.curPage = this.pdfDoc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.curPage);
    this.y = MARGIN;
    return this.curPage;
  }

  /** Convert top-down Y to pdf-lib bottom-up Y for a given line height */
  pt(topY: number, h = 0) {
    return PAGE_H - topY - h;
  }

  /** Ensure there's `needed` vertical space left; add page if not */
  ensure(needed: number) {
    if (this.y + needed > PAGE_H - MARGIN - 30) {
      this.addPage();
    }
  }

  fill(x: number, topY: number, w: number, h: number, color: ReturnType<typeof rgb>) {
    fillRect(this.curPage, x, this.pt(topY + h), w, h, color);
  }

  text(text: string, opts: Omit<TextOpts, "y"> & { topY: number }) {
    const { topY, ...rest } = opts;
    drawText(this.curPage, text, { ...rest, y: this.pt(topY, opts.size) });
  }

  line(x1: number, y1: number, x2: number, y2: number, color: ReturnType<typeof rgb>, width = 0.5) {
    this.curPage.drawLine({
      start: { x: x1, y: this.pt(y1) },
      end:   { x: x2, y: this.pt(y2) },
      thickness: width,
      color,
    });
  }
}

interface Fonts {
  regular: PDFFont;
  bold:    PDFFont;
  italic:  PDFFont;
}

// ── table helpers ─────────────────────────────────────────────────────────────

interface ColDef {
  label: string;
  x: number;
  w: number;
  align?: "left" | "right" | "center";
}

function drawTableHeader(pm: PageManager, fonts: Fonts, cols: ColDef): void;
function drawTableHeader(pm: PageManager, fonts: Fonts, cols: ColDef[]): void;
function drawTableHeader(pm: PageManager, fonts: Fonts, cols: ColDef | ColDef[]) {
  const colArr = Array.isArray(cols) ? cols : [cols];
  const rowH = 20;
  pm.fill(MARGIN, pm.y, W, rowH, C.accent);
  for (const col of colArr) {
    pm.text(col.label, {
      font: fonts.bold, size: 8, color: C.white,
      x: col.x, topY: pm.y + (rowH - 8) / 2,
      maxWidth: col.w, align: col.align ?? "left",
    });
  }
  pm.y += rowH;
}

interface CellDef {
  text: string;
  x: number;
  w: number;
  align?: "left" | "right" | "center";
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
}

function drawTableRow(
  pm: PageManager,
  fonts: Fonts,
  cells: CellDef[],
  rowH: number,
  bg: ReturnType<typeof rgb>
) {
  pm.fill(MARGIN, pm.y, W, rowH, bg);
  for (const cell of cells) {
    pm.text(cell.text, {
      font: cell.bold ? fonts.bold : fonts.regular,
      size: 8.5,
      color: cell.color ?? C.text,
      x: cell.x,
      topY: pm.y + (rowH - 8.5) / 2,
      maxWidth: cell.w,
      align: cell.align ?? "left",
    });
  }
  // bottom border
  pm.line(MARGIN, pm.y + rowH, MARGIN + W, pm.y + rowH, hex("#E5E7EB"), 0.3);
  pm.y += rowH;
}

// ── main PDF builder ──────────────────────────────────────────────────────────

async function buildPDF(
  type: "statement" | "uc",
  project: {
    title: string; grantType: string; sanctionNumber: string;
    startDate: Date; endDate: Date; totalBudget: number;
    hostInstitution: string; piName: string; piDesignation: string;
  },
  budgetHeads: {
    headName: string; category: string; allocatedAmount: number;
    expenditures: { expenditureDate: Date; description: string; amount: number; voucherNumber: string | null }[];
  }[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold:    await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic:  await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  };

  const pm = new PageManager(pdfDoc);
  pm.setFonts(fonts);
  pm.addPage();

  const totalAllocated = budgetHeads.reduce((s, bh) => s + bh.allocatedAmount, 0);
  const totalSpent     = budgetHeads.reduce((s, bh) => s + bh.expenditures.reduce((ss, e) => ss + e.amount, 0), 0);
  const totalBalance   = totalAllocated - totalSpent;

  const docTitle = type === "statement" ? "EXPENDITURE STATEMENT" : "UTILIZATION CERTIFICATE";

  // ── HEADER BANNER ──────────────────────────────────────────────────────────
  pm.fill(MARGIN, pm.y, W, 52, C.dark);

  pm.text("ANRF — ResearchPilot", {
    font: fonts.regular, size: 8, color: hex("#A5B4FC"),
    x: MARGIN, topY: pm.y + 10, maxWidth: W, align: "center",
  });
  pm.text(docTitle, {
    font: fonts.bold, size: 15, color: C.white,
    x: MARGIN, topY: pm.y + 22, maxWidth: W, align: "center",
  });
  pm.text(`Generated: ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`, {
    font: fonts.regular, size: 7.5, color: hex("#A5B4FC"),
    x: MARGIN, topY: pm.y + 42, maxWidth: W, align: "right",
  });
  pm.y += 62;

  // ── PROJECT INFO TABLE ─────────────────────────────────────────────────────
  const meta: [string, string][] = [
    ["Project Title",    project.title],
    ["Grant Type",       project.grantType],
    ["Sanction No.",     project.sanctionNumber],
    ["Host Institution", project.hostInstitution],
    ["PI Name",          project.piName],
    ["Period",           `${fmtDate(project.startDate)} to ${fmtDate(project.endDate)}`],
    ["Total Budget",     INR(project.totalBudget)],
    ["Total Spent",      INR(totalSpent)],
    ["Balance",          INR(totalBalance)],
  ];

  const halfW = W / 2;
  for (let i = 0; i < meta.length; i++) {
    const [label, value] = meta[i];
    const bg = i % 2 === 0 ? C.gray : C.white;
    pm.fill(MARGIN, pm.y, W, 18, bg);
    pm.text(label, {
      font: fonts.bold, size: 8, color: C.label,
      x: MARGIN + 6, topY: pm.y + 5, maxWidth: halfW - 12,
    });
    pm.text(value, {
      font: fonts.regular, size: 8, color: C.text,
      x: MARGIN + 6 + halfW, topY: pm.y + 5, maxWidth: halfW - 12,
    });
    pm.y += 18;
  }
  pm.y += 10;

  // ── BUDGET SUMMARY TABLE ───────────────────────────────────────────────────
  pm.text("Budget Head Summary", {
    font: fonts.bold, size: 11, color: C.dark,
    x: MARGIN, topY: pm.y,
  });
  pm.y += 16;

  const sumCols: ColDef[] = [
    { label: "#",               x: MARGIN,      w: 20,  align: "center" },
    { label: "Budget Head",     x: MARGIN + 22, w: 120, align: "left"   },
    { label: "Category",        x: MARGIN + 144,w: 80,  align: "left"   },
    { label: "Allocated (Rs.)", x: MARGIN + 226,w: 90,  align: "right"  },
    { label: "Spent (Rs.)",     x: MARGIN + 318,w: 85,  align: "right"  },
    { label: "Balance (Rs.)",   x: MARGIN + 405,w: 85,  align: "right"  },
    { label: "% Used",          x: MARGIN + 492,w: 43,  align: "right"  },
  ];
  drawTableHeader(pm, fonts, sumCols);

  for (let i = 0; i < budgetHeads.length; i++) {
    const bh    = budgetHeads[i];
    pm.ensure(22);
    const spent = bh.expenditures.reduce((s, e) => s + e.amount, 0);
    const bal   = bh.allocatedAmount - spent;
    const pct   = bh.allocatedAmount > 0 ? `${((spent / bh.allocatedAmount) * 100).toFixed(1)}%` : "-";
    const cat   = bh.category === "NON_RECURRING" ? "Non-Recurring" : "Recurring";
    const bg    = i % 2 === 0 ? C.white : C.gray;

    drawTableRow(pm, fonts, [
      { text: String(i + 1),          x: MARGIN,       w: 20,  align: "center" },
      { text: bh.headName,             x: MARGIN + 22,  w: 120 },
      { text: cat,                     x: MARGIN + 144, w: 80  },
      { text: INR(bh.allocatedAmount), x: MARGIN + 226, w: 90,  align: "right" },
      { text: INR(spent),              x: MARGIN + 318, w: 85,  align: "right" },
      { text: INR(bal),                x: MARGIN + 405, w: 85,  align: "right", bold: true, color: bal < 0 ? C.red : C.text },
      { text: pct,                     x: MARGIN + 492, w: 43,  align: "right" },
    ], 20, bg);
  }

  // Total row
  pm.ensure(22);
  drawTableRow(pm, fonts, [
    { text: "",                  x: MARGIN,       w: 20  },
    { text: "TOTAL",             x: MARGIN + 22,  w: 200, bold: true, color: C.white },
    { text: "",                  x: MARGIN + 224, w: 1   },
    { text: INR(totalAllocated), x: MARGIN + 226, w: 90,  align: "right", bold: true, color: C.white },
    { text: INR(totalSpent),     x: MARGIN + 318, w: 85,  align: "right", bold: true, color: C.white },
    { text: INR(totalBalance),   x: MARGIN + 405, w: 85,  align: "right", bold: true, color: C.white },
    {
      text: totalAllocated > 0 ? `${((totalSpent / totalAllocated) * 100).toFixed(1)}%` : "-",
      x: MARGIN + 492, w: 43, align: "right", bold: true, color: C.white,
    },
  ], 22, C.dark);

  pm.y += 14;

  // ── EXPENDITURE DETAIL (statement only) ───────────────────────────────────
  if (type === "statement") {
    for (const bh of budgetHeads) {
      if (bh.expenditures.length === 0) continue;

      pm.ensure(60);
      const bhSpent = bh.expenditures.reduce((s, e) => s + e.amount, 0);
      const cat = bh.category === "NON_RECURRING" ? "Non-Recurring" : "Recurring";

      // Budget head sub-header
      pm.fill(MARGIN, pm.y, W, 22, C.accent);
      pm.text(`${bh.headName}  (${cat})`, {
        font: fonts.bold, size: 9.5, color: C.white,
        x: MARGIN + 6, topY: pm.y + 6, maxWidth: W * 0.65,
      });
      pm.text(`Total: ${INR(bhSpent)}`, {
        font: fonts.bold, size: 9.5, color: C.white,
        x: MARGIN, topY: pm.y + 6, maxWidth: W - 8, align: "right",
      });
      pm.y += 22;

      const detCols: ColDef[] = [
        { label: "#",            x: MARGIN,       w: 20,  align: "center" },
        { label: "Date",         x: MARGIN + 22,  w: 72,  align: "left"   },
        { label: "Description",  x: MARGIN + 96,  w: 230, align: "left"   },
        { label: "Voucher No.",  x: MARGIN + 328, w: 80,  align: "left"   },
        { label: "Amount (Rs.)", x: MARGIN + 410, w: 125, align: "right"  },
      ];
      drawTableHeader(pm, fonts, detCols);

      for (let j = 0; j < bh.expenditures.length; j++) {
        const e  = bh.expenditures[j];
        pm.ensure(20);
        const bg = j % 2 === 0 ? C.white : C.gray;
        drawTableRow(pm, fonts, [
          { text: String(j + 1),          x: MARGIN,       w: 20,  align: "center" },
          { text: fmtDate(e.expenditureDate), x: MARGIN + 22, w: 72  },
          { text: e.description,           x: MARGIN + 96,  w: 230 },
          { text: e.voucherNumber ?? "-",  x: MARGIN + 328, w: 80  },
          { text: INR(e.amount),           x: MARGIN + 410, w: 125, align: "right" },
        ], 20, bg);
      }

      // sub-total
      pm.ensure(20);
      drawTableRow(pm, fonts, [
        { text: "",           x: MARGIN,       w: 20  },
        { text: "",           x: MARGIN + 22,  w: 72  },
        { text: "Sub-total",  x: MARGIN + 96,  w: 230, bold: true },
        { text: "",           x: MARGIN + 328, w: 80  },
        { text: INR(bhSpent), x: MARGIN + 410, w: 125, align: "right", bold: true },
      ], 20, C.light);
      pm.y += 10;
    }
  }

  // ── CERTIFICATION BLOCK (UC only) ─────────────────────────────────────────
  if (type === "uc") {
    pm.ensure(200);
    pm.y += 6;

    // Divider
    pm.line(MARGIN, pm.y, MARGIN + W, pm.y, C.accent, 1);
    pm.y += 12;

    pm.text("CERTIFICATE", { font: fonts.bold, size: 11, color: C.dark, x: MARGIN, topY: pm.y });
    pm.y += 18;

    const certText =
      `I/We hereby certify that a sum of ${INR(totalSpent)} ` +
      `(Rupees ${totalSpent.toLocaleString("en-IN")} only) has been utilized for the purpose ` +
      `for which it was sanctioned and that the amount has been utilized in accordance with the ` +
      `terms and conditions of the grant. The grant received, the actual utilization and the ` +
      `unspent balance returned are as indicated above. The accounts are subject to audit by the ` +
      `Comptroller and Auditor General of India. No part of the above grant money has been ` +
      `utilized for unauthorized purposes.`;

    const certLines = wrapText(certText, fonts.regular, 9.5, W);
    for (const line of certLines) {
      pm.ensure(14);
      pm.text(line, { font: fonts.regular, size: 9.5, color: C.text, x: MARGIN, topY: pm.y });
      pm.y += 14;
    }
    pm.y += 20;

    pm.ensure(100);

    // 3-column signature block
    const sigW = W / 3;
    const sigLabels  = [project.piName,          "Finance Officer / Registrar", "Head of Institution"];
    const sigSubs    = [project.piDesignation,    project.hostInstitution,       project.hostInstitution];

    for (let i = 0; i < 3; i++) {
      const sx = MARGIN + i * sigW;
      pm.line(sx + 10, pm.y, sx + sigW - 20, pm.y, C.label, 0.8);
      pm.text(sigLabels[i], {
        font: fonts.bold, size: 8.5, color: C.dark,
        x: sx, topY: pm.y + 8, maxWidth: sigW, align: "center",
      });
      pm.text(sigSubs[i], {
        font: fonts.regular, size: 7.5, color: C.muted,
        x: sx, topY: pm.y + 20, maxWidth: sigW, align: "center",
      });
      pm.text("Date: ___________", {
        font: fonts.regular, size: 7.5, color: C.muted,
        x: sx, topY: pm.y + 32, maxWidth: sigW, align: "center",
      });
    }
    pm.y += 52;

    pm.text(
      "Note: This document is system-generated from ResearchPilot. Physical signatures are required for official submission.",
      { font: fonts.italic, size: 7.5, color: C.subtle, x: MARGIN, topY: pm.y, maxWidth: W, align: "center" }
    );
  }

  // ── PAGE FOOTERS ───────────────────────────────────────────────────────────
  const totalPages = pm.pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pm.pages[i];
    const footerY = 20; // 20pt from bottom
    page.drawText(
      `ResearchPilot  |  ${project.sanctionNumber}  |  ${docTitle}`,
      { x: MARGIN, y: footerY, size: 7.5, font: fonts.regular, color: C.subtle }
    );
    const pageLabel = `Page ${i + 1} of ${totalPages}`;
    const pw = fonts.regular.widthOfTextAtSize(pageLabel, 7.5);
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - pw, y: footerY, size: 7.5, font: fonts.regular, color: C.subtle,
    });
  }

  return pdfDoc.save();
}

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const type = (searchParams.get("type") ?? "statement") as "statement" | "uc";

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

    const pdfBytes = await buildPDF(
      type,
      {
        title:           project.title,
        grantType:       project.grantType,
        sanctionNumber:  project.sanctionNumber,
        startDate:       project.startDate,
        endDate:         project.endDate,
        totalBudget:     Number(project.totalBudget),
        hostInstitution: project.hostInstitution,
        piName:          project.pi.name,
        piDesignation:   project.pi.designation ?? "Principal Investigator",
      },
      project.budgetHeads.map((bh) => ({
        headName:        bh.headName,
        category:        bh.category,
        allocatedAmount: Number(bh.allocatedAmount),
        expenditures:    bh.expenditures.map((e) => ({
          expenditureDate: e.expenditureDate,
          description:     e.description,
          amount:          Number(e.amount),
          voucherNumber:   e.voucherNumber,
        })),
      }))
    );

    const safeName = project.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const fileName =
      type === "uc"
        ? `utilization_certificate_${safeName}.pdf`
        : `expenditure_statement_${safeName}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error("[PDF Export Error]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}