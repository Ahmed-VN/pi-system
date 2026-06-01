import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/budget-heads?projectId=xxx
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const heads = await prisma.budgetHead.findMany({
      where: { projectId },
      include: { expenditures: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      heads.map((h) => ({
        id: h.id,
        name: h.headName,
        category: h.category,
        allocatedAmount: Number(h.allocatedAmount),
        expenditures: h.expenditures.map((e) => ({
          id: e.id,
          amount: Number(e.amount),
          description: e.description,
          date: e.expenditureDate.toISOString(),
          invoiceNumber: e.voucherNumber ?? null,
          vendor: null,
          createdAt: e.createdAt.toISOString(),
        })),
      }))
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/budget-heads — create a new budget head
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { projectId, headName, category, allocatedAmount } = body;

    if (!projectId || !headName || !category || !allocatedAmount) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Only PI can add budget heads
    const user = await prisma.user.findUnique({ where: { email: session.user!.email! } });
    if (!user || user.role !== "PI") {
      return NextResponse.json({ error: "Only PI can add budget heads" }, { status: 403 });
    }

    const head = await prisma.budgetHead.create({
      data: {
        projectId,
        headName,
        category,
        allocatedAmount,
      },
    });

    return NextResponse.json({
      id: head.id,
      name: head.headName,
      category: head.category,
      allocatedAmount: Number(head.allocatedAmount),
      expenditures: [],
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/budget-heads?id=xxx
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.budgetHead.delete({ where: { id } });
    return NextResponse.json({ message: "Budget head deleted" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}