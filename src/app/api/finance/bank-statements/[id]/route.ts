// src/app/api/finance/bank-statements/[id]/route.ts
//
// GET: full detail for one statement — used to render the Category Review screen.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const statement = await prisma.bankStatement.findUnique({
    where: { id },
    include: {
      transactions: {
        orderBy: { transactionDate: "asc" },
        include: {
          matchedExpenditure: {
            select: { id: true, description: true, amount: true, expenditureDate: true },
          },
        },
      },
      uploadedBy: { select: { name: true } },
    },
  });

  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const conflictLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "BankTransaction",
      action: "PARSE_CONFLICT_FLAGGED",
      entityId: { in: statement.transactions.map((t) => t.id) },
    },
    select: { entityId: true, formulaUsed: true },
  });
  const conflictMap = new Map(conflictLogs.map((l) => [l.entityId, l.formulaUsed]));

  return NextResponse.json({
    id: statement.id,
    bankName: statement.bankName,
    accountNumber: statement.accountNumber,
    statementPeriodStart: statement.statementPeriodStart,
    statementPeriodEnd: statement.statementPeriodEnd,
    parsingStatus: statement.parsingStatus,
    parsingErrors: statement.parsingErrors,
    openingBalance: statement.openingBalance ? Number(statement.openingBalance) : null,
    closingBalance: statement.closingBalance ? Number(statement.closingBalance) : null,
    uploadedByName: statement.uploadedBy.name,
    createdAt: statement.createdAt,
    transactions: statement.transactions.map((t) => ({
      id: t.id,
      transactionDate: t.transactionDate,
      narration: t.narration,
      referenceNumber: t.referenceNumber,
      debit: t.debit ? Number(t.debit) : null,
      credit: t.credit ? Number(t.credit) : null,
      balance: Number(t.balance),
      category: t.category,
      matchConfidence: t.matchConfidence,
      matchedExpenditure: t.matchedExpenditure
        ? {
            id: t.matchedExpenditure.id,
            description: t.matchedExpenditure.description,
            amount: Number(t.matchedExpenditure.amount),
            expenditureDate: t.matchedExpenditure.expenditureDate,
          }
        : null,
      parseConflict: conflictMap.get(t.id) ?? null,
    })),
  });
}