import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/procurement/requests/[id]/payment-release
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  // expected body: { invoiceNumber, invoiceAmount, invoiceDate }

  const procurementRequest = await prisma.procurementRequest.findUnique({
    where: { id },
  });
  if (!procurementRequest) {
    return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const expenditure = await tx.expenditure.create({
      data: {
        projectId: procurementRequest.projectId,
        budgetHeadId: procurementRequest.budgetHeadId,
        amount: body.invoiceAmount,
        description: procurementRequest.itemDescription,
        voucherNumber: body.invoiceNumber,
        expenditureDate: new Date(body.invoiceDate),
      },
    });

    const releaseRequest = await tx.paymentReleaseRequest.create({
      data: {
        procurementRequestId: id,
        invoiceNumber: body.invoiceNumber,
        invoiceAmount: body.invoiceAmount,
        invoiceDate: new Date(body.invoiceDate),
        checklistComplete: false,
        releasedAt: new Date(),
        expenditureId: expenditure.id,
      },
    });

    await tx.procurementRequest.update({
      where: { id },
      data: { status: "PAID" },
    });

    return { releaseRequest, expenditure };
  });

  return NextResponse.json(result);
}