// src/app/api/procurement/requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_SOURCING_TYPES = ["GEM", "NON_GEM", "PROPRIETARY"];

// GET /api/procurement/requests?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;

  if (session.user.role === "JRF" || session.user.role === "CO_PI") {
    where.submittedById = session.user.id;
  }

  const requests = await prisma.procurementRequest.findMany({
    where,
    include: {
      submittedBy: { select: { id: true, name: true, role: true } },
      approvedBy: { select: { id: true, name: true } },
      budgetHead: { select: { id: true, headName: true, category: true } },
      project: { select: { id: true, title: true, sanctionNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = requests.map((r) => ({
    ...r,
    estimatedCost: Number(r.estimatedCost),
  }));

  return NextResponse.json(serialized);
}

// POST /api/procurement/requests
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["JRF", "CO_PI", "PI"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    projectId,
    budgetHeadId,
    itemName,
    itemDescription,
    quantity,
    estimatedCost,
    justification,
    sourcingType,
    vendorName,
    vendorAddress,
    vendorGst,
    quoteReference,
    submitNow,
  } = body;

  if (
    !projectId ||
    !budgetHeadId ||
    !itemName ||
    !itemDescription ||
    !quantity ||
    !estimatedCost ||
    !justification
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const resolvedSourcingType = sourcingType ?? "NON_GEM";
  if (!VALID_SOURCING_TYPES.includes(resolvedSourcingType)) {
    return NextResponse.json(
      { error: `Invalid sourcingType: ${resolvedSourcingType}` },
      { status: 400 }
    );
  }

  const request = await prisma.procurementRequest.create({
    data: {
      projectId,
      budgetHeadId,
      submittedById: session.user.id,
      itemName,
      itemDescription,
      quantity: Number(quantity),
      estimatedCost,
      justification,
      sourcingType: resolvedSourcingType,
      vendorName: vendorName ?? null,
      vendorAddress: vendorAddress ?? null,
      vendorGst: vendorGst ?? null,
      quoteReference: quoteReference ?? null,
      status: submitNow ? "SUBMITTED" : "DRAFT",
    },
    include: {
      submittedBy: { select: { id: true, name: true, role: true } },
      budgetHead: { select: { id: true, headName: true } },
      project: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(
    { ...request, estimatedCost: Number(request.estimatedCost) },
    { status: 201 }
  );
}