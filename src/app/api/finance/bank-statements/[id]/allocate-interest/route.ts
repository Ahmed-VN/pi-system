// src/app/api/finance/bank-statements/[id]/allocate-interest/route.ts
//
// POST: find every BankTransaction in this statement categorized INTEREST, run the
// pro-rata allocation, persist InterestAllocation rows, write AuditLog entries.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allocateInterest } from "@/lib/finance-engine/interest-allocation";

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
    include: { transactions: { where: { category: "INTEREST" } } },
  });
  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  if (statement.transactions.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No transactions categorized as INTEREST in this statement — nothing to allocate.",
      allocations: [],
    });
  }

  const [grantReleases, expenditures] = await Promise.all([
    prisma.grantRelease.findMany({
      where: { projectId: statement.projectId },
      select: { recurringAmount: true, nonRecurringAmount: true, sanctionDate: true },
    }),
    prisma.expenditure.findMany({
      where: { projectId: statement.projectId },
      select: { amount: true, expenditureDate: true, budgetHead: { select: { category: true } } },
    }),
  ]);

  const grantReleaseInputs = grantReleases.map((g) => ({
    recurringAmount: g.recurringAmount ? Number(g.recurringAmount) : null,
    nonRecurringAmount: g.nonRecurringAmount ? Number(g.nonRecurringAmount) : null,
    sanctionDate: g.sanctionDate,
  }));

  const expenditureInputs = expenditures.map((e) => ({
    amount: Number(e.amount),
    category: e.budgetHead.category,
    expenditureDate: e.expenditureDate,
  }));

  const results = statement.transactions.map((t) =>
    allocateInterest(
      { id: t.id, transactionDate: t.transactionDate, credit: Number(t.credit ?? 0) },
      grantReleaseInputs,
      expenditureInputs
    )
  );

  await prisma.$transaction(async (tx) => {
    for (const r of results) {
      await tx.interestAllocation.upsert({
        where: { bankTransactionId: r.bankTransactionId },
        create: {
          bankTransactionId: r.bankTransactionId,
          recurringInterest: r.recurringInterest,
          nonRecurringInterest: r.nonRecurringInterest,
          recurringBalanceBefore: r.recurringBalanceBefore,
          nonRecurringBalanceBefore: r.nonRecurringBalanceBefore,
          allocationMethod: "PRO_RATA_BALANCE",
        },
        update: {
          recurringInterest: r.recurringInterest,
          nonRecurringInterest: r.nonRecurringInterest,
          recurringBalanceBefore: r.recurringBalanceBefore,
          nonRecurringBalanceBefore: r.nonRecurringBalanceBefore,
          calculatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          projectId: statement.projectId,
          entityType: "InterestAllocation",
          entityId: r.bankTransactionId,
          action: "INTEREST_ALLOCATE",
          formulaUsed: r.warning
            ? `Recurring ₹${r.recurringInterest} / Non-recurring ₹${r.nonRecurringInterest} (balance before: ₹${r.recurringBalanceBefore} / ₹${r.nonRecurringBalanceBefore}) — WARNING: ${r.warning}`
            : `Recurring ₹${r.recurringInterest} / Non-recurring ₹${r.nonRecurringInterest} (balance before: ₹${r.recurringBalanceBefore} / ₹${r.nonRecurringBalanceBefore})`,
          performedById: session.user.id,
        },
      });
    }
  });

  return NextResponse.json({
    success: true,
    allocations: results,
    warningsCount: results.filter((r) => r.warning !== null).length,
  });
}