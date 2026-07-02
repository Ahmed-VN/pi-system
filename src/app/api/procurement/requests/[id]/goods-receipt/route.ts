import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/procurement/requests/[id]/goods-receipt
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  // expected body: { deliveryDate, installationDate?, condition, installationReportNote? }

  const procurementRequest = await prisma.procurementRequest.findUnique({
    where: { id },
  });
  if (!procurementRequest) {
    return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const goodsReceipt = await tx.goodsReceipt.create({
      data: {
        procurementRequestId: id,
        deliveryDate: new Date(body.deliveryDate),
        installationDate: body.installationDate ? new Date(body.installationDate) : null,
        condition: body.condition,
        installationReportNote: body.installationReportNote ?? null,
      },
    });

    const asset = await tx.asset.create({
      data: {
        projectId: procurementRequest.projectId,
        procurementRequestId: id,
        name: procurementRequest.itemDescription,
        purchaseAmount: procurementRequest.estimatedCost,
        acquisitionDate: new Date(body.deliveryDate),
      },
    });

    await tx.procurementRequest.update({
      where: { id },
      data: { status: "RECEIVED" },
    });

    return { goodsReceipt, asset };
  });

  return NextResponse.json(result);
}