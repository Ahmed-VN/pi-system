// src/app/api/finance/bank-statements/transactions/[id]/route.ts
//
// PATCH: manually override a transaction's category (from the Category Review screen).
// Every override is written to AuditLog — this is what makes the "why is this
// categorized as X" trail auditable later.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TransactionCategory } from "@prisma/client";

const VALID_CATEGORIES: TransactionCategory[] = [
  "INTEREST",
  "GRANT",
  "BANK_CHARGE",
  "TAX",
  "REFUND",
  "EXPENDITURE",
  "UNCATEGORIZED",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const newCategory = body.category as TransactionCategory;

  if (!VALID_CATEGORIES.includes(newCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const existing = await prisma.bankTransaction.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (existing.category === newCategory) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  const [updated] = await prisma.$transaction([
    prisma.bankTransaction.update({
      where: { id },
      data: { category: newCategory },
    }),
    prisma.auditLog.create({
      data: {
        projectId: existing.projectId,
        entityType: "BankTransaction",
        entityId: id,
        action: "MANUAL_CATEGORIZE_OVERRIDE",
        formulaUsed: `${existing.category} -> ${newCategory} (manual override)`,
        performedById: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    id: updated.id,
    category: updated.category,
  });
}