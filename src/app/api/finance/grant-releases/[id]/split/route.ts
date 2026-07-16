// src/app/api/finance/grant-releases/[id]/split/route.ts
//
// PATCH: set recurringAmount + nonRecurringAmount on an existing GrantRelease.
// Required before UC generation will work for that release's period — the
// reconciliation guard blocks generation until every relevant release has this set.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const recurringAmount = Number(body.recurringAmount);
  const nonRecurringAmount = Number(body.nonRecurringAmount);

  if (!Number.isFinite(recurringAmount) || !Number.isFinite(nonRecurringAmount)) {
    return NextResponse.json({ error: "Both amounts must be valid numbers" }, { status: 400 });
  }
  if (recurringAmount < 0 || nonRecurringAmount < 0) {
    return NextResponse.json({ error: "Amounts cannot be negative" }, { status: 400 });
  }

  const existing = await prisma.grantRelease.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Grant release not found" }, { status: 404 });
  }

  const total = recurringAmount + nonRecurringAmount;
  const originalAmount = Number(existing.amount);
  if (Math.abs(total - originalAmount) > 0.01) {
    return NextResponse.json(
      {
        error: `Recurring + Non-Recurring (₹${total}) must equal the release's total amount (₹${originalAmount})`,
      },
      { status: 400 }
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.grantRelease.update({
      where: { id },
      data: { recurringAmount, nonRecurringAmount },
    }),
    prisma.auditLog.create({
      data: {
        projectId: existing.projectId,
        entityType: "GrantRelease",
        entityId: id,
        action: "MANUAL_SPLIT_SET",
        formulaUsed: `Recurring ₹${recurringAmount} / Non-Recurring ₹${nonRecurringAmount} (total ₹${total})`,
        performedById: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    id: updated.id,
    recurringAmount: Number(updated.recurringAmount),
    nonRecurringAmount: Number(updated.nonRecurringAmount),
  });
}