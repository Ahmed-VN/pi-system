// src/app/api/finance/export/uc-docx/route.ts
//
// REPLACES the previous version. Key changes:
// 1. Requires a `fundType` param (RECURRING | NON_RECURRING) — generates ONE of the
//    two separate UC documents per call, not a single combined document. GRANT_NATURE
//    is now dynamic, not hardcoded.
// 2. Interest is now AUTO-COMPUTED from InterestAllocation rows (Phase 5) when bank
//    statement data exists for this project, instead of always trusting manually
//    typed interestEarned/interestDeposited query params. Manual params remain as a
//    fallback ONLY when no bank statements exist at all for the project (the
//    "manual interest mode" from the original three-mode design).
// 3. Blocked by the reconciliation guard — returns 409 with the blocker list instead
//    of generating a document if the underlying data isn't clean enough to trust.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { checkReconciliation } from "@/lib/finance-engine/reconciliation-guard";
import { computeUCFigures, type FundType } from "@/lib/finance-engine/uc-calculation";

function fmt(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function grantLabel(g: string): string {
  const map: Record<string, string> = {
    ARG: "ANRF Research Grant (ARG)",
    IRG: "International Research Grant (IRG)",
    PM_ECRG: "PM Early Career Research Grant (PM-ECRG)",
  };
  return map[g] ?? g;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId");
  const fy = sp.get("fy");
  const fundTypeParam = sp.get("fundType");
  const ucStatus = sp.get("ucStatus") ?? "Provisional";
  const manualInterestEarned = Number(sp.get("interestEarned") ?? 0);
  const interestDeposited = Number(sp.get("interestDeposited") ?? 0);
  const cfoName = sp.get("cfoName") ?? "—";
  const headOrgName = sp.get("headOrgName") ?? "—";
  const certPlace = sp.get("certPlace") ?? "—";

  if (!projectId || !fy) {
    return NextResponse.json({ error: "projectId and fy are required" }, { status: 400 });
  }
  if (fundTypeParam !== "RECURRING" && fundTypeParam !== "NON_RECURRING") {
    return NextResponse.json(
      { error: "fundType must be RECURRING or NON_RECURRING — generate each UC separately" },
      { status: 400 }
    );
  }
  const fundType = fundTypeParam as FundType;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { pi: { select: { name: true } } },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // ── Reconciliation guard ──
  const reconciliation = await checkReconciliation(projectId);
  if (!reconciliation.canGenerateUC) {
    return NextResponse.json(
      {
        error: "Cannot generate UC — unresolved data issues",
        blockers: reconciliation.blockers,
        warnings: reconciliation.warnings,
      },
      { status: 409 }
    );
  }

  // ── Gather data for computeUCFigures ──
  const [grantReleases, expenditures, hasBankStatements] = await Promise.all([
    prisma.grantRelease.findMany({
      where: { projectId },
      select: { sanctionNo: true, sanctionDate: true, recurringAmount: true, nonRecurringAmount: true },
    }),
    prisma.expenditure.findMany({
      where: { projectId },
      select: { amount: true, expenditureDate: true, budgetHead: { select: { category: true } } },
    }),
    prisma.bankStatement.count({ where: { projectId } }),
  ]);

  const interestTxns = await prisma.bankTransaction.findMany({
    where: { projectId, category: "INTEREST" },
    include: { interestAllocation: true },
  });

  const grantReleaseInputs = grantReleases.map((g) => ({
    sanctionNo: g.sanctionNo,
    sanctionDate: g.sanctionDate,
    recurringAmount: g.recurringAmount ? Number(g.recurringAmount) : null,
    nonRecurringAmount: g.nonRecurringAmount ? Number(g.nonRecurringAmount) : null,
  }));

  const expenditureInputs = expenditures.map((e) => ({
    amount: Number(e.amount),
    category: e.budgetHead.category as FundType,
    expenditureDate: e.expenditureDate,
  }));

  const interestAllocationInputs = interestTxns
    .filter((t) => t.interestAllocation !== null)
    .map((t) => ({
      recurringInterest: Number(t.interestAllocation!.recurringInterest),
      nonRecurringInterest: Number(t.interestAllocation!.nonRecurringInterest),
      transactionDate: t.transactionDate,
    }));

  const figures = computeUCFigures(
    fundType,
    fy,
    grantReleaseInputs,
    expenditureInputs,
    interestAllocationInputs
  );

  // Manual interest fallback ONLY when no bank statements exist for this project at all
  // (the "manual interest mode" case) — otherwise the computed figure is authoritative.
  const interestEarned = hasBankStatements > 0 ? figures.interestEarnedThisFY : manualInterestEarned;

  const totalAvailable = figures.openingBalance + figures.grantReceivedThisFY + interestEarned - interestDeposited;
  const closingBalance = totalAvailable - figures.expenditureThisFY;

  // ── Load & render template ──
  const templatePath = path.join(
    process.cwd(), "public", "templates", "anrf-utilization-certificate.docx"
  );
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json(
      { error: "Template not found at public/templates/anrf-utilization-certificate.docx" },
      { status: 500 }
    );
  }

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const { end } = { end: new Date(Date.UTC(Number(fy.split("-")[0]) + 1, 2, 31)) };

  const data: Record<string, string> = {
    FY_YEAR: fy,
    AS_ON_DATE: end.toLocaleDateString("en-GB"),
    UC_STATUS: ucStatus,
    GRANT_NATURE: fundType === "RECURRING" ? "RECURRING" : "NON-RECURRING",

    ORG_NAME: project.hostInstitution,
    PI_NAME: project.pi.name,
    SANCTION_NO: project.sanctionNumber,
    SANCTION_DATE: project.startDate.toLocaleDateString("en-GB"),
    PROJECT_TITLE: project.title,
    SCHEME_NAME: grantLabel(project.grantType),

    OPENING_BALANCE: fmt(figures.openingBalance),
    OPENING_OTHERS: fmt(0),
    OPENING_TOTAL: fmt(figures.openingBalance),

    INTEREST_EARNED: fmt(interestEarned),
    INTEREST_DEPOSITED: fmt(interestDeposited),

    GRANT_SANCTION_NO: figures.releasesThisFY.map((r) => r.sanctionNo).join("\n") || "—",
    GRANT_SANCTION_DATE:
      figures.releasesThisFY.map((r) => r.sanctionDate.toLocaleDateString("en-GB")).join("\n") || "—",
    GRANT_AMOUNT: figures.releasesThisFY.map((r) => fmt(r.amount)).join("\n") || fmt(0),

    TOTAL_AVAILABLE_FUNDS: fmt(totalAvailable),
    EXPENDITURE_INCURRED: fmt(figures.expenditureThisFY),
    CLOSING_BALANCE: fmt(closingBalance),

    GRANT_GENERAL: fundType === "RECURRING" ? fmt(figures.expenditureThisFY) : fmt(0),
    GRANT_CAPITAL: fundType === "NON_RECURRING" ? fmt(figures.expenditureThisFY) : fmt(0),
    GRANT_TOTAL: fmt(figures.expenditureThisFY),

    CASH_IN_HAND: fmt(closingBalance),
    REFUNDS_TO_ANRF: fmt(0),
    CARRY_FORWARD: fmt(closingBalance),

    CERT_DATE: new Date().toLocaleDateString("en-GB"),
    CERT_PLACE: certPlace,
    CFO_NAME: cfoName,
    HEAD_ORG_NAME: headOrgName,
  };

  doc.render(data);
  const buf = doc.getZip().generate({ type: "nodebuffer" });

  const safeSanction = project.sanctionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
  const fundLabel = fundType === "RECURRING" ? "Recurring" : "NonRecurring";
  const filename = `UC-${fundLabel}-${safeSanction}-${fy}.docx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}