// src/app/api/finance/bank-statements/[id]/mark-reviewed/route.ts
//
// POST: human explicitly attests they've reviewed the flagged rows on this statement.
// Sets parsingStatus back to PARSED and logs who/when — the attestation itself is the
// audit trail entry, same principle as everything else in this module.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const statement = await prisma.bankStatement.findUnique({ where: { id } });
  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const [updated] = await prisma.$transaction([
    prisma.bankStatement.update({
      where: { id },
      data: { parsingStatus: "PARSED" },
    }),
    prisma.auditLog.create({
      data: {
        projectId: statement.projectId,
        entityType: "BankStatement",
        entityId: id,
        action: "MANUALLY_MARKED_REVIEWED",
        formulaUsed: `Flagged rows manually reviewed and accepted by user — status changed from NEEDS_REVIEW to PARSED`,
        performedById: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({ success: true, parsingStatus: updated.parsingStatus });
}