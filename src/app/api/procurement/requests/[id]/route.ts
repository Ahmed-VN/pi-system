// src/app/api/procurement/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET /api/procurement/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const request = await prisma.procurementRequest.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, name: true, role: true, designation: true } },
      approvedBy:  { select: { id: true, name: true } },
      budgetHead:  { select: { id: true, headName: true, category: true, allocatedAmount: true } },
      project: {
        include: {
          pi:          { select: { id: true, name: true, designation: true, institution: true } },
          budgetHeads: { select: { id: true, headName: true, category: true, allocatedAmount: true } },
        },
      },
      documents: true,
    },
  });

  if (!request)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...request,
    estimatedCost: Number(request.estimatedCost),
    budgetHead: {
      ...request.budgetHead,
      allocatedAmount: Number(request.budgetHead.allocatedAmount),
    },
    project: {
      ...request.project,
      totalBudget: Number(request.project.totalBudget),
      startDate:   request.project.startDate.toISOString(),
      endDate:     request.project.endDate.toISOString(),
      budgetHeads: request.project.budgetHeads.map((bh) => ({
        ...bh,
        allocatedAmount: Number(bh.allocatedAmount),
      })),
    },
  });
}

// PATCH /api/procurement/[id]
// body actions: { action: "submit" | "approve" | "reject", rejectionReason?: string }
// Also handles field updates when action is omitted (for DRAFT editing)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action, rejectionReason, ...fields } = body;

  const existing = await prisma.procurementRequest.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── SUBMIT (JRF / CO_PI / PI submitting their own draft) ─────────
  if (action === "submit") {
    if (existing.submittedById !== session.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED")
      return NextResponse.json({ error: "Only DRAFT or REJECTED requests can be submitted" }, { status: 400 });

    const updated = await prisma.procurementRequest.update({
      where: { id },
      data: { status: "SUBMITTED", rejectionReason: null },
    });
    return NextResponse.json({ ...updated, estimatedCost: Number(updated.estimatedCost) });
  }

  // ── APPROVE (PI only) ─────────────────────────────────────────────
  if (action === "approve") {
    if (session.user.role !== "PI")
      return NextResponse.json({ error: "Only PI can approve" }, { status: 403 });
    if (existing.status !== "SUBMITTED")
      return NextResponse.json({ error: "Only SUBMITTED requests can be approved" }, { status: 400 });

    const updated = await prisma.procurementRequest.update({
      where: { id },
      data: {
        status:      "APPROVED",
        approvedById: session.user.id,
        approvedAt:  new Date(),
        rejectionReason: null,
      },
      include: {
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // Create notification for submitter
    await prisma.notification.create({
      data: {
        userId:  existing.submittedById,
        title:   "Procurement Request Approved",
        message: `Your request for "${existing.itemName}" has been approved by the PI.`,
        type:    "SUCCESS",
        link:    `/dashboard/procurement/${id}`,
      },
    });

    return NextResponse.json({ ...updated, estimatedCost: Number(updated.estimatedCost) });
  }

  // ── REJECT (PI only) ──────────────────────────────────────────────
  if (action === "reject") {
    if (session.user.role !== "PI")
      return NextResponse.json({ error: "Only PI can reject" }, { status: 403 });
    if (existing.status !== "SUBMITTED")
      return NextResponse.json({ error: "Only SUBMITTED requests can be rejected" }, { status: 400 });
    if (!rejectionReason?.trim())
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });

    const updated = await prisma.procurementRequest.update({
      where: { id },
      data: {
        status:          "REJECTED",
        rejectionReason: rejectionReason.trim(),
        approvedById:    null,
        approvedAt:      null,
      },
    });

    // Notify submitter
    await prisma.notification.create({
      data: {
        userId:  existing.submittedById,
        title:   "Procurement Request Rejected",
        message: `Your request for "${existing.itemName}" was rejected. Reason: ${rejectionReason.trim()}`,
        type:    "WARNING",
        link:    `/dashboard/procurement/${id}`,
      },
    });

    return NextResponse.json({ ...updated, estimatedCost: Number(updated.estimatedCost) });
  }

  // ── EDIT DRAFT fields ─────────────────────────────────────────────
  if (!action) {
    if (existing.submittedById !== session.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED")
      return NextResponse.json({ error: "Only DRAFT or REJECTED requests can be edited" }, { status: 400 });

    const updated = await prisma.procurementRequest.update({
      where: { id },
      data: {
        ...(fields.itemName        !== undefined && { itemName: fields.itemName }),
        ...(fields.itemDescription !== undefined && { itemDescription: fields.itemDescription }),
        ...(fields.quantity        !== undefined && { quantity: Number(fields.quantity) }),
        ...(fields.estimatedCost   !== undefined && { estimatedCost: fields.estimatedCost }),
        ...(fields.justification   !== undefined && { justification: fields.justification }),
        ...(fields.sourcingType    !== undefined && { sourcingType: fields.sourcingType }),
        ...(fields.vendorName      !== undefined && { vendorName: fields.vendorName }),
        ...(fields.vendorAddress   !== undefined && { vendorAddress: fields.vendorAddress }),
        ...(fields.vendorGst       !== undefined && { vendorGst: fields.vendorGst }),
        ...(fields.quoteReference  !== undefined && { quoteReference: fields.quoteReference }),
        ...(fields.budgetHeadId    !== undefined && { budgetHeadId: fields.budgetHeadId }),
      },
    });
    return NextResponse.json({ ...updated, estimatedCost: Number(updated.estimatedCost) });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE /api/procurement/[id]  — PI only
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "PI")
    return NextResponse.json({ error: "Only PI can delete procurement requests" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.procurementRequest.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.procurementRequest.delete({ where: { id } });

  return NextResponse.json({ success: true });
}