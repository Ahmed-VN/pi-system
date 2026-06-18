import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/projects/[id] ───────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      OR: [
        { pi: { email: session.user.email! } },
        { personnelRecords: { some: { user: { email: session.user.email! } } } },
      ],
    },
    include: {
      pi: { select: { name: true, email: true } },
      milestones: { orderBy: { dueDate: "asc" } },
      budgetHeads: { include: { expenditures: true } },
      personnelRecords: {
        include: {
          user: { select: { name: true, email: true, designation: true } },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serialized = {
    ...project,
    totalBudget: Number(project.totalBudget),
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    budgetHeads: project.budgetHeads.map((b) => ({
      ...b,
      allocatedAmount: Number(b.allocatedAmount),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      expenditures: b.expenditures.map((e) => ({
        ...e,
        amount: Number(e.amount),
        expenditureDate: e.expenditureDate.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
    })),
    milestones: project.milestones.map((m) => ({
      ...m,
      dueDate: m.dueDate?.toISOString() ?? null,
      completedAt: m.completedAt?.toISOString() ?? null,
    })),
    documents: project.documents.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      expiryDate: d.expiryDate?.toISOString() ?? null,
    })),
    personnelRecords: project.personnelRecords.map((r) => ({
      ...r,
      joinDate: r.joinDate?.toISOString() ?? null,
      endDate: r.endDate?.toISOString() ?? null,
    })),
  };

  return NextResponse.json(serialized);
}

// ─── PATCH /api/projects/[id] ─────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const existing = await prisma.project.findFirst({
    where: { id, pi: { email: session.user.email! } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const allowed = [
    "title", "description", "status", "startDate",
    "endDate", "hostInstitution", "sanctionNumber",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  for (const key of allowed) {
    if (key in body) {
      if (key === "status") {
        const valid = ["ACTIVE", "EXTENDED", "CLOSED", "PENDING"];
        if (!valid.includes(body.status)) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${valid.join(", ")}` },
            { status: 400 }
          );
        }
      }
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({
    ...updated,
    totalBudget: Number(updated.totalBudget),
    startDate: updated.startDate?.toISOString() ?? null,
    endDate: updated.endDate?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

// ─── DELETE /api/projects/[id] ────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const existing = await prisma.project.findFirst({
    where: { id, pi: { email: session.user.email! } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}