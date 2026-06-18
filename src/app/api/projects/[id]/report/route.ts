import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

// ── helpers ───────────────────────────────────────────────────────────────────
const INR = (n: number) =>
  "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

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
  green:  hex("#16A34A"),
  amber:  hex("#D97706"),
  white:  rgb(1, 1, 1),
  text:   hex("#111827"),
  muted:  hex("#6B7280"),
  subtle: hex("#9CA3AF"),
  label:  hex("#374151"),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const W      = PAGE_W - MARGIN * 2;

// ── low-level drawing helpers ─────────────────────────────────────────────────
function fillRect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

interface TextOpts {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
  x: number;
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

// ── page manager ───────────────────────────────────────────────────────────────
class PageManager {
  pages: PDFPage[] = [];
  private pdfDoc: PDFDocument;
  private fonts!: Fonts;
  curPage!: PDFPage;
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

  pt(topY: number, h = 0) {
    return PAGE_H - topY - h;
  }

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

function drawTableHeader(pm: PageManager, fonts: Fonts, cols: ColDef[]) {
  const rowH = 20;
  pm.fill(MARGIN, pm.y, W, rowH, C.accent);
  for (const col of cols) {
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

function drawTableRow(pm: PageManager, fonts: Fonts, cells: CellDef[], rowH: number, bg: ReturnType<typeof rgb>) {
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
  pm.line(MARGIN, pm.y + rowH, MARGIN + W, pm.y + rowH, hex("#E5E7EB"), 0.3);
  pm.y += rowH;
}

// ── status helpers ────────────────────────────────────────────────────────────
const MILESTONE_STATUS: Record<string, { label: string; color: ReturnType<typeof rgb> }> = {
  PENDING:     { label: "Pending",     color: C.subtle },
  IN_PROGRESS: { label: "In Progress", color: C.accent },
  COMPLETED:   { label: "Completed",   color: C.green },
  DELAYED:     { label: "Delayed",     color: C.red },
};

const ROLE_LABEL: Record<string, string> = {
  PI: "PI", CO_PI: "Co-PI", JRF: "JRF", ADMIN: "Admin",
};

// ── data shapes ────────────────────────────────────────────────────────────────
interface ReportProject {
  title: string; grantType: string; sanctionNumber: string; status: string;
  startDate: Date; endDate: Date; totalBudget: number;
  hostInstitution: string; piName: string; piDesignation: string;
}
interface ReportMilestone {
  title: string; dueDate: Date; completedAt: Date | null; status: string;
}
interface ReportPersonnel {
  name: string; role: string; joinDate: Date; endDate: Date | null; stipend: number | null;
}
interface ReportBudgetHead {
  headName: string; category: string; allocatedAmount: number;
  spent: number;
}

// ── main PDF builder ──────────────────────────────────────────────────────────
async function buildProgressReportPDF(
  project: ReportProject,
  milestones: ReportMilestone[],
  personnel: ReportPersonnel[],
  budgetHeads: ReportBudgetHead[]
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

  // ── derived stats ─────────────────────────────────────────────────────────
  const totalMilestones     = milestones.length;
  const completedMilestones = milestones.filter((m) => m.status === "COMPLETED").length;
  const milestonePct        = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const totalAllocated = budgetHeads.reduce((s, b) => s + b.allocatedAmount, 0);
  const totalSpent     = budgetHeads.reduce((s, b) => s + b.spent, 0);
  const budgetPct      = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  const now = new Date();
  const daysRemaining = Math.ceil((project.endDate.getTime() - now.getTime()) / 86400000);
  const activeTeamSize = personnel.filter((p) => !p.endDate || p.endDate > now).length;

  // ── HEADER BANNER ────────────────────────────────────────────────────────
  pm.fill(MARGIN, pm.y, W, 52, C.dark);
  pm.text("ANRF — ResearchPilot", {
    font: fonts.regular, size: 8, color: hex("#A5B4FC"),
    x: MARGIN, topY: pm.y + 10, maxWidth: W, align: "center",
  });
  pm.text("PROJECT PROGRESS REPORT", {
    font: fonts.bold, size: 15, color: C.white,
    x: MARGIN, topY: pm.y + 22, maxWidth: W, align: "center",
  });
  pm.text(`Generated: ${now.toLocaleDateString("en-IN", { dateStyle: "long" })}`, {
    font: fonts.regular, size: 7.5, color: hex("#A5B4FC"),
    x: MARGIN, topY: pm.y + 42, maxWidth: W, align: "right",
  });
  pm.y += 62;

  // ── PROJECT INFO TABLE ───────────────────────────────────────────────────
  const meta: [string, string][] = [
    ["Project Title",    project.title],
    ["Grant Type",       project.grantType],
    ["Sanction No.",     project.sanctionNumber],
    ["Status",           project.status],
    ["Host Institution", project.hostInstitution],
    ["PI Name",          project.piName],
    ["Period",           `${fmtDate(project.startDate)} to ${fmtDate(project.endDate)}`],
    ["Total Budget",     INR(project.totalBudget)],
  ];
  const halfW = W / 2;
  for (let i = 0; i < meta.length; i++) {
    const [label, value] = meta[i];
    const bg = i % 2 === 0 ? C.gray : C.white;
    pm.fill(MARGIN, pm.y, W, 18, bg);
    pm.text(label, { font: fonts.bold, size: 8, color: C.label, x: MARGIN + 6, topY: pm.y + 5, maxWidth: halfW - 12 });
    pm.text(value, { font: fonts.regular, size: 8, color: C.text, x: MARGIN + 6 + halfW, topY: pm.y + 5, maxWidth: halfW - 12 });
    pm.y += 18;
  }
  pm.y += 14;

  // ── SUMMARY STAT BOXES ───────────────────────────────────────────────────
  const gap = 10;
  const boxW = (W - gap * 3) / 4;
  const boxH = 50;
  const stats: { label: string; value: string; color: ReturnType<typeof rgb> }[] = [
    { label: "Milestones",       value: `${completedMilestones}/${totalMilestones} (${milestonePct.toFixed(0)}%)`, color: C.accent },
    { label: "Budget Utilized",  value: `${budgetPct.toFixed(1)}%`,                                                  color: budgetPct > 90 ? C.red : C.accent },
    { label: daysRemaining >= 0 ? "Days Remaining" : "Days Overdue", value: `${Math.abs(daysRemaining)}`,            color: daysRemaining < 0 ? C.red : C.green },
    { label: "Active Team Size", value: `${activeTeamSize}`,                                                        color: C.accent },
  ];
  pm.ensure(boxH + 10);
  for (let i = 0; i < stats.length; i++) {
    const bx = MARGIN + i * (boxW + gap);
    pm.fill(bx, pm.y, boxW, boxH, C.gray);
    pm.line(bx, pm.y, bx + boxW, pm.y, stats[i].color, 2.5);
    pm.text(stats[i].value, {
      font: fonts.bold, size: 14, color: stats[i].color,
      x: bx, topY: pm.y + 18, maxWidth: boxW, align: "center",
    });
    pm.text(stats[i].label, {
      font: fonts.regular, size: 7.5, color: C.muted,
      x: bx, topY: pm.y + 36, maxWidth: boxW, align: "center",
    });
  }
  pm.y += boxH + 18;

  // ── MILESTONES TABLE ─────────────────────────────────────────────────────
  pm.ensure(40);
  pm.text("Milestones", { font: fonts.bold, size: 11, color: C.dark, x: MARGIN, topY: pm.y });
  pm.y += 16;

  if (milestones.length === 0) {
    pm.text("No milestones recorded for this project.", {
      font: fonts.italic, size: 9, color: C.muted, x: MARGIN, topY: pm.y,
    });
    pm.y += 20;
  } else {
    const msCols: ColDef[] = [
      { label: "#",          x: MARGIN,       w: 20,  align: "center" },
      { label: "Milestone",  x: MARGIN + 22,  w: 200, align: "left"   },
      { label: "Due Date",   x: MARGIN + 224, w: 70,  align: "left"   },
      { label: "Status",     x: MARGIN + 296, w: 80,  align: "center" },
      { label: "Completed",  x: MARGIN + 378, w: 80,  align: "left"   },
    ];
    drawTableHeader(pm, fonts, msCols);

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      pm.ensure(22);
      const bg = i % 2 === 0 ? C.white : C.gray;
      const st = MILESTONE_STATUS[m.status] ?? MILESTONE_STATUS.PENDING;
      drawTableRow(pm, fonts, [
        { text: String(i + 1),      x: MARGIN,       w: 20,  align: "center" },
        { text: m.title,             x: MARGIN + 22,  w: 200 },
        { text: fmtDate(m.dueDate),  x: MARGIN + 224, w: 70  },
        { text: st.label,            x: MARGIN + 296, w: 80,  align: "center", bold: true, color: st.color },
        { text: fmtDate(m.completedAt), x: MARGIN + 378, w: 80 },
      ], 20, bg);
    }
  }
  pm.y += 14;

  // ── TEAM TABLE ───────────────────────────────────────────────────────────
  pm.ensure(40);
  pm.text("Project Team", { font: fonts.bold, size: 11, color: C.dark, x: MARGIN, topY: pm.y });
  pm.y += 16;

  if (personnel.length === 0) {
    pm.text("No team members recorded for this project.", {
      font: fonts.italic, size: 9, color: C.muted, x: MARGIN, topY: pm.y,
    });
    pm.y += 20;
  } else {
    const teamCols: ColDef[] = [
      { label: "#",            x: MARGIN,       w: 20,  align: "center" },
      { label: "Name",         x: MARGIN + 22,  w: 140, align: "left"   },
      { label: "Role",         x: MARGIN + 164, w: 80,  align: "center" },
      { label: "Join Date",    x: MARGIN + 246, w: 80,  align: "left"   },
      { label: "End Date",     x: MARGIN + 328, w: 80,  align: "left"   },
      { label: "Stipend (Rs.)",x: MARGIN + 410, w: 105, align: "right"  },
    ];
    drawTableHeader(pm, fonts, teamCols);

    for (let i = 0; i < personnel.length; i++) {
      const p = personnel[i];
      pm.ensure(22);
      const bg = i % 2 === 0 ? C.white : C.gray;
      const isActive = !p.endDate || p.endDate > now;
      drawTableRow(pm, fonts, [
        { text: String(i + 1),                    x: MARGIN,       w: 20,  align: "center" },
        { text: p.name,                            x: MARGIN + 22,  w: 140 },
        { text: ROLE_LABEL[p.role] ?? p.role,       x: MARGIN + 164, w: 80,  align: "center" },
        { text: fmtDate(p.joinDate),                x: MARGIN + 246, w: 80  },
        { text: p.endDate ? fmtDate(p.endDate) : (isActive ? "Active" : "-"), x: MARGIN + 328, w: 80, color: isActive ? C.green : C.text },
        { text: p.stipend != null ? INR(p.stipend) : "-", x: MARGIN + 410, w: 105, align: "right" },
      ], 20, bg);
    }
  }
  pm.y += 14;

  // ── FINANCIAL SUMMARY TABLE ──────────────────────────────────────────────
  pm.ensure(40);
  pm.text("Financial Summary", { font: fonts.bold, size: 11, color: C.dark, x: MARGIN, topY: pm.y });
  pm.y += 16;

  const finCols: ColDef[] = [
    { label: "#",               x: MARGIN,       w: 20,  align: "center" },
    { label: "Budget Head",     x: MARGIN + 22,  w: 120, align: "left"   },
    { label: "Category",        x: MARGIN + 144, w: 80,  align: "left"   },
    { label: "Allocated (Rs.)", x: MARGIN + 226, w: 90,  align: "right"  },
    { label: "Spent (Rs.)",     x: MARGIN + 318, w: 85,  align: "right"  },
    { label: "Balance (Rs.)",   x: MARGIN + 405, w: 85,  align: "right"  },
    { label: "% Used",          x: MARGIN + 492, w: 43,  align: "right"  },
  ];
  drawTableHeader(pm, fonts, finCols);

  for (let i = 0; i < budgetHeads.length; i++) {
    const bh  = budgetHeads[i];
    pm.ensure(22);
    const bal = bh.allocatedAmount - bh.spent;
    const pct = bh.allocatedAmount > 0 ? `${((bh.spent / bh.allocatedAmount) * 100).toFixed(1)}%` : "-";
    const cat = bh.category === "NON_RECURRING" ? "Non-Recurring" : "Recurring";
    const bg  = i % 2 === 0 ? C.white : C.gray;
    drawTableRow(pm, fonts, [
      { text: String(i + 1),          x: MARGIN,       w: 20,  align: "center" },
      { text: bh.headName,             x: MARGIN + 22,  w: 120 },
      { text: cat,                     x: MARGIN + 144, w: 80  },
      { text: INR(bh.allocatedAmount), x: MARGIN + 226, w: 90,  align: "right" },
      { text: INR(bh.spent),           x: MARGIN + 318, w: 85,  align: "right" },
      { text: INR(bal),                x: MARGIN + 405, w: 85,  align: "right", bold: true, color: bal < 0 ? C.red : C.text },
      { text: pct,                     x: MARGIN + 492, w: 43,  align: "right" },
    ], 20, bg);
  }

  pm.ensure(22);
  drawTableRow(pm, fonts, [
    { text: "",                  x: MARGIN,       w: 20  },
    { text: "TOTAL",             x: MARGIN + 22,  w: 200, bold: true, color: C.white },
    { text: "",                  x: MARGIN + 224, w: 1   },
    { text: INR(totalAllocated), x: MARGIN + 226, w: 90,  align: "right", bold: true, color: C.white },
    { text: INR(totalSpent),     x: MARGIN + 318, w: 85,  align: "right", bold: true, color: C.white },
    { text: INR(totalAllocated - totalSpent), x: MARGIN + 405, w: 85, align: "right", bold: true, color: C.white },
    { text: totalAllocated > 0 ? `${budgetPct.toFixed(1)}%` : "-", x: MARGIN + 492, w: 43, align: "right", bold: true, color: C.white },
  ], 22, C.dark);

  // ── FOOTER NOTE ──────────────────────────────────────────────────────────
  pm.ensure(40);
  pm.y += 16;
  pm.text(
    "Note: This is a system-generated overview report from ResearchPilot, combining live milestone, team, and expenditure data at the time of generation.",
    { font: fonts.italic, size: 7.5, color: C.subtle, x: MARGIN, topY: pm.y, maxWidth: W, align: "center" }
  );

  // ── PAGE FOOTERS ─────────────────────────────────────────────────────────
  const totalPages = pm.pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pm.pages[i];
    const footerY = 20;
    page.drawText(`ResearchPilot  |  ${project.sanctionNumber}  |  PROGRESS REPORT`, {
      x: MARGIN, y: footerY, size: 7.5, font: fonts.regular, color: C.subtle,
    });
    const pageLabel = `Page ${i + 1} of ${totalPages}`;
    const pw = fonts.regular.widthOfTextAtSize(pageLabel, 7.5);
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - pw, y: footerY, size: 7.5, font: fonts.regular, color: C.subtle,
    });
  }

  return pdfDoc.save();
}

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pi: { select: { name: true, designation: true } },
        milestones: { orderBy: { dueDate: "asc" } },
        personnelRecords: {
          include: { user: { select: { name: true } } },
          orderBy: { joinDate: "asc" },
        },
        budgetHeads: {
          include: { expenditures: true },
          orderBy: { headName: "asc" },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const pdfBytes = await buildProgressReportPDF(
      {
        title:           project.title,
        grantType:       project.grantType,
        sanctionNumber:  project.sanctionNumber,
        status:          project.status,
        startDate:       project.startDate,
        endDate:         project.endDate,
        totalBudget:     Number(project.totalBudget),
        hostInstitution: project.hostInstitution,
        piName:          project.pi.name,
        piDesignation:   project.pi.designation ?? "Principal Investigator",
      },
      project.milestones.map((m) => ({
        title: m.title,
        dueDate: m.dueDate,
        completedAt: m.completedAt,
        status: m.status,
      })),
      project.personnelRecords.map((p) => ({
        name: p.user.name,
        role: p.role,
        joinDate: p.joinDate,
        endDate: p.endDate,
        stipend: p.stipend != null ? Number(p.stipend) : null,
      })),
      project.budgetHeads.map((bh) => ({
        headName: bh.headName,
        category: bh.category,
        allocatedAmount: Number(bh.allocatedAmount),
        spent: bh.expenditures.reduce((s, e) => s + Number(e.amount), 0),
      }))
    );

    const safeName = project.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="progress_report_${safeName}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[Progress Report Error]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}