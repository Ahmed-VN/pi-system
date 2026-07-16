// src/app/api/finance/bank-statements/[id]/match/route.ts
//
// POST: run the expenditure matcher over every debit transaction in this statement,
// persist matchedExpenditureId + matchConfidence, write an AuditLog entry per row
// explaining the match reasoning (source txn + formula, per the audit requirements).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { matchTransaction, type MatchInput } from "@/lib/finance-engine/match";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: statementId } = await params;

  const statement = await prisma.bankStatement.findUnique({
    where: { id: statementId },
    include: { transactions: true },
  });
  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  // Pull conflict flags the same way the review UI does (stored in AuditLog, not a column)
  const conflictLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "BankTransaction",
      action: "PARSE_CONFLICT_FLAGGED",
      entityId: { in: statement.transactions.map((t) => t.id) },
    },
    select: { entityId: true },
  });
  const conflictedIds = new Set(conflictLogs.map((l) => l.entityId));

  // Candidate pool: all expenditures for this project. (Date-window pre-filtering could
  // be added later for performance on large projects; fine as-is for now.)
  const expenditures = await prisma.expenditure.findMany({
    where: { projectId: statement.projectId },
    select: { id: true, amount: true, expenditureDate: true },
  });
  const candidates = expenditures.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    expenditureDate: e.expenditureDate,
  }));

  const results = statement.transactions.map((t) => {
    const input: MatchInput = {
      id: t.id,
      transactionDate: t.transactionDate,
      debit: t.debit ? Number(t.debit) : null,
      category: t.category,
      parseConflict: conflictedIds.has(t.id) ? "flagged" : null,
    };
    return matchTransaction(input, candidates);
  });

  await prisma.$transaction(async (tx) => {
    for (const r of results) {
      await tx.bankTransaction.update({
        where: { id: r.bankTransactionId },
        data: {
          matchedExpenditureId: r.matchedExpenditureId,
          matchConfidence: r.matchConfidence,
        },
      });

      await tx.auditLog.create({
        data: {
          projectId: statement.projectId,
          entityType: "BankTransaction",
          entityId: r.bankTransactionId,
          action: "AUTO_MATCH",
          formulaUsed: r.reasoning,
          performedById: session.user.id,
        },
      });
    }
  });

  const summary = {
    exact: results.filter((r) => r.matchConfidence === "EXACT").length,
    likely: results.filter((r) => r.matchConfidence === "LIKELY").length,
    uncertain: results.filter((r) => r.matchConfidence === "UNCERTAIN").length,
    unmatched: results.filter((r) => r.matchConfidence === "UNMATCHED").length,
  };

  return NextResponse.json({ success: true, summary, results });
}