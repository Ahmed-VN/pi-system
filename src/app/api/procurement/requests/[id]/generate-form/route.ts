// src/app/api/procurement/[id]/generate-form/route.ts
//
// Generates an auto-filled NIT Calicut / ANRF Procurement Requisition Form (.docx)
// Template must be placed at: public/templates/anrf-procurement-requisition.docx
//
// Install deps (already in project): npm install docxtemplater pizzip
//
// ── PLACEHOLDER MAP (matches injected template exactly) ─────────────
//
//  {INDENTER_NAME}        – Name of the person raising the request (submitter)
//  {INDENTER_DESIGNATION} – Designation of submitter
//  {INDENTER_EMAIL}       – Email of submitter (from User model)
//  {INDENTER_PHONE}       – Phone of submitter
//
//  {PI_NAME_DESIGNATION}  – PI name + designation (row 2: Guide/Mentor)
//  {DEPARTMENT}           – Department/School/Section (hostInstitution)
//
//  {FUNDING_AGENCY}       – "ANRF" + grant type label
//  {PROJECT_TITLE}        – Full project title
//  {PROJECT_ACCOUNT_NO}   – Sanction number (used as project account no.)
//  {BUDGET_SUBHEAD}       – Budget head name + category
//  {BALANCE_AVAILABLE}    – Allocated amount of the budget head
//
//  {ITEM_NAME}            – Item name
//  {QUANTITY}             – Quantity
//  {ESTIMATED_COST}       – Estimated cost formatted in ₹

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

type Params = { params: Promise<{ id: string }> };

function formatCurrency(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function grantLabel(g: string): string {
  const map: Record<string, string> = {
    ARG:     "ANRF Research Grant (ARG)",
    IRG:     "International Research Grant (IRG)",
    PM_ECRG: "PM Early Career Research Grant (PM-ECRG)",
  };
  return map[g] ?? g;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const pr = await prisma.procurementRequest.findUnique({
    where: { id },
    include: {
      submittedBy: {
        select: { name: true, role: true, designation: true, email: true, phone: true },
      },
      approvedBy: { select: { name: true, designation: true } },
      budgetHead: {
        select: { headName: true, category: true, allocatedAmount: true },
      },
      project: {
        include: {
          pi: { select: { name: true, designation: true } },
          expenditures: { select: { amount: true, budgetHeadId: true } },
        },
      },
    },
  });

  if (!pr)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (pr.status !== "APPROVED")
    return NextResponse.json(
      { error: "Form can only be generated for APPROVED requests" },
      { status: 400 }
    );

  // Calculate balance in the budget head
  const spent = pr.project.expenditures
    .filter((e) => e.budgetHeadId === pr.budgetHeadId)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = Number(pr.budgetHead.allocatedAmount) - spent;

  // Load template
  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    "anrf-procurement-requisition.docx"
  );
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json(
      {
        error:
          "Template not found at public/templates/anrf-procurement-requisition.docx. " +
          "Please copy the provided template file to that location.",
      },
      { status: 500 }
    );
  }

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
  });

  const piDesig = pr.project.pi.designation
    ? `${pr.project.pi.name}, ${pr.project.pi.designation}`
    : pr.project.pi.name;

  const submitterDesig = pr.submittedBy.designation ?? pr.submittedBy.role.replace("_", "-");

  const data: Record<string, string> = {
    // Row 1 — Indenter details (submitter)
    INDENTER_NAME:        pr.submittedBy.name,
    INDENTER_DESIGNATION: submitterDesig,
    INDENTER_EMAIL:       pr.submittedBy.email,
    INDENTER_PHONE:       pr.submittedBy.phone ?? "—",

    // Row 2 — Guide/PI
    PI_NAME_DESIGNATION:  piDesig,

    // Row 3 — Department
    DEPARTMENT:           pr.project.hostInstitution,

    // Row 4 — Funding / Project info
    FUNDING_AGENCY:       `ANRF — ${grantLabel(pr.project.grantType)}`,
    PROJECT_TITLE:        pr.project.title,
    PROJECT_ACCOUNT_NO:   pr.project.sanctionNumber,
    BUDGET_SUBHEAD:       `${pr.budgetHead.headName} (${pr.budgetHead.category.replace("_", "-")})`,
    BALANCE_AVAILABLE:    formatCurrency(balance),

    // Row 5 — Item
    ITEM_NAME:            pr.itemName,
    QUANTITY:             String(pr.quantity),

    // Row 6 — Cost
    ESTIMATED_COST:       formatCurrency(Number(pr.estimatedCost)),
  };

  doc.render(data);

  const buf = doc.getZip().generate({ type: "nodebuffer" });

  const safeSanction = pr.project.sanctionNumber.replace(/[^a-zA-Z0-9-]/g, "_");
  const filename = `Procurement-Requisition-${safeSanction}-${id.slice(0, 6)}.docx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}