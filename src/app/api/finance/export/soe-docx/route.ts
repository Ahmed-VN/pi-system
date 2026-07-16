// src/app/api/finance/export/soe-docx/route.ts
//
// REPLACES the docx-library version. Now fills your REAL official template
// (public/templates/anrf-soe-statement.docx) via docxtemplater — same proven
// pattern as your existing uc-docx route — so formatting is pixel-exact to the
// official form instead of an approximation.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  computeSOEFiguresV2,
  type BudgetHeadForSOE,
  type ExpenditureForSOE,
  type SOERowV2,
} from "@/lib/finance-engine/soe-calculation";
import { fyRangeSOE } from "@/lib/finance-engine/soe-calculation";

function fmt(n: number): string {
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}
function fmtPlain(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

// Maps each canonical head to the placeholder prefix baked into the template.
const HEAD_PREFIX: Record<string, string> = {
  "Manpower costs": "MANPOWER",
  Consumables: "CONSUMABLES",
  Travel: "TRAVEL",
  Contingencies: "CONTINGENCIES",
  "Others, if any": "OTHERS",
  Equipment: "EQUIPMENT",
  "Overhead expenses": "OVERHEAD",
};

function rowToPlaceholders(row: SOERowV2, prefix: string): Record<string, string> {
  return {
    [`${prefix}_SANCTIONED`]: fmtPlain(row.sanctioned),
    [`${prefix}_Y1`]: fmtPlain(row.year1),
    [`${prefix}_Y2`]: fmtPlain(row.year2),
    [`${prefix}_Y3`]: fmtPlain(row.year3plus),
    [`${prefix}_TILLDATE`]: fmtPlain(row.totalTillDate),
    [`${prefix}_BALANCE`]: fmtPlain(row.balance),
    [`${prefix}_REQNEXT`]: fmtPlain(row.requirementNextYear),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId");
  const fy = sp.get("fy");
  if (!projectId || !fy) {
    return NextResponse.json({ error: "projectId and fy are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      pi: { select: { name: true } },
      budgetHeads: {
        include: { expenditures: { select: { amount: true, expenditureDate: true } } },
      },
      grantReleases: { select: { amount: true, sanctionDate: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const budgetHeadInputs: BudgetHeadForSOE[] = project.budgetHeads.map((bh) => ({
    headName: bh.headName,
    allocatedAmount: Number(bh.allocatedAmount),
  }));
  const expenditureInputs: ExpenditureForSOE[] = project.budgetHeads.flatMap((bh) =>
    bh.expenditures.map((e) => ({
      headName: bh.headName,
      amount: Number(e.amount),
      expenditureDate: e.expenditureDate,
    }))
  );
  const grantReleaseInputs = project.grantReleases.map((g) => ({
    amount: Number(g.amount),
    date: g.sanctionDate,
  }));

  const interestTxns = await prisma.bankTransaction.findMany({
    where: { projectId, category: "INTEREST" },
    include: { interestAllocation: true },
  });
  const { start: fyStart, end: fyEnd } = fyRangeSOE(fy);
  const interestThisFY = interestTxns
    .filter((t) => t.transactionDate >= fyStart && t.transactionDate <= fyEnd && t.interestAllocation)
    .reduce(
      (s, t) => s + Number(t.interestAllocation!.recurringInterest) + Number(t.interestAllocation!.nonRecurringInterest),
      0
    );

  const soe = computeSOEFiguresV2(
    fy,
    project.startDate,
    budgetHeadInputs,
    expenditureInputs,
    grantReleaseInputs,
    interestThisFY
  );

  // ── Month-wise expenditure for the target FY ──
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthBuckets = new Map<string, number>();
  for (const e of expenditureInputs) {
    if (e.expenditureDate < fyStart || e.expenditureDate > fyEnd) continue;
    const key = `${monthNames[e.expenditureDate.getUTCMonth()]} ${e.expenditureDate.getUTCFullYear()}`;
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + e.amount);
  }
  const months =
    monthBuckets.size > 0
      ? [...monthBuckets.entries()].map(([label, amt]) => ({
          MONTH_LABEL: label,
          EXP_AMOUNT: fmt(amt),
        }))
      : [{ MONTH_LABEL: "NIL", EXP_AMOUNT: "NIL" }];

  // ── Build the flat placeholder data object for docxtemplater ──
  const data: Record<string, unknown> = {
    SANCTION_NO: `${project.sanctionNumber} dt ${project.startDate.toLocaleDateString("en-GB")}`,
    PI_NAME: project.pi.name,
    TOTAL_COST: fmt(Number(project.totalBudget)),
    REVISED_COST: "-",
    DOS: project.startDate.toLocaleDateString("en-GB"),
    GRANT_Y1: fmt(soe.grantReceived.year1),
    GRANT_Y2: fmt(soe.grantReceived.year2),
    GRANT_Y3: fmt(soe.grantReceived.year3),
    INTEREST_EARNED: fmt(soe.grantReceived.interest),
    GRANT_TOTAL: fmt(soe.grantReceived.total),
    MONTHS: months,
  };

  for (const row of soe.rows) {
    const prefix = HEAD_PREFIX[row.headName];
    Object.assign(data, rowToPlaceholders(row, prefix));
  }
  Object.assign(
    data,
    rowToPlaceholders(
      {
        headName: "Total" as SOERowV2["headName"],
        sanctioned: soe.totals.sanctioned,
        year1: soe.totals.year1,
        year2: soe.totals.year2,
        year3plus: soe.totals.year3plus,
        totalTillDate: soe.totals.totalTillDate,
        balance: soe.totals.balance,
        requirementNextYear: soe.totals.requirementNextYear,
      },
      "TOTAL"
    )
  );

  // ── Load & render the real official template ──
  const templatePath = path.join(process.cwd(), "public", "templates", "anrf-soe-statement.docx");
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json(
      { error: "Template not found at public/templates/anrf-soe-statement.docx" },
      { status: 500 }
    );
  }

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  try {
    doc.render(data);
  } catch (err) {
    return NextResponse.json({ error: "Template render failed", detail: String(err) }, { status: 500 });
  }

  const buf = doc.getZip().generate({ type: "nodebuffer" });
  const safeSanction = project.sanctionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
  const filename = `SOE-${safeSanction}-${fy}.docx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}