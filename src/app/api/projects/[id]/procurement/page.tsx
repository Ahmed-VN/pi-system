import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProcurementClient from "./ProcurementClient";
import { getApprovalTier } from "@/lib/procurement-rules";

export default async function ProcurementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [project, requests, budgetHeads] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    }),
    prisma.procurementRequest.findMany({
      where: { projectId },
      include: {
        budgetHead: { select: { headName: true, allocatedAmount: true } },
        submittedBy: { select: { name: true } },
        goodsReceipt: { select: { id: true, condition: true, deliveryDate: true } },
        paymentReleaseRequest: { select: { id: true, invoiceAmount: true } },
        documents: { select: { id: true, documentType: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.budgetHead.findMany({
      where: { projectId },
      select: {
        id: true,
        headName: true,
        projectId: true,
        allocatedAmount: true,
      },
    }),
  ]);

  if (!project) redirect("/dashboard");

  // Serialize Decimal fields
  // goodsReceipt and paymentReleaseRequest are singular (one-to-one) per schema
  const serializedRequests = requests.map((r: typeof requests[number]) => ({
    ...r,
    budgetHead: { name: r.budgetHead.headName },
    estimatedAmount: Number(r.estimatedCost),
    approvalTier: getApprovalTier(Number(r.estimatedCost)),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    goodsReceipt: r.goodsReceipt
      ? {
          ...r.goodsReceipt,
          deliveryDate: r.goodsReceipt.deliveryDate.toISOString(),
        }
      : null,
    paymentReleaseRequest: r.paymentReleaseRequest
      ? {
          ...r.paymentReleaseRequest,
          invoiceAmount: Number(r.paymentReleaseRequest.invoiceAmount),
        }
      : null,
  }));

  const serializedBudgetHeads = budgetHeads.map((b: typeof budgetHeads[number]) => ({
    id: b.id,
    name: b.headName,
    projectId: b.projectId,
    // BudgetHead has allocatedAmount; balance requires expenditure sum
    // Pass allocatedAmount as balance for now — adjust if you track utilized separately
    balance: Number(b.allocatedAmount),
  }));

  return (
    <ProcurementClient
      project={project}
      requests={serializedRequests}
      budgetHeads={serializedBudgetHeads}
      currentUserId={session.user.id!}
    />
  );
}