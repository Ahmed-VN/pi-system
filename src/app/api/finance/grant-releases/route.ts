import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const releases = await prisma.grantRelease.findMany({
    where: { projectId },
    orderBy: { sanctionDate: "asc" },
  });

  return NextResponse.json(releases);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "PI")
    return NextResponse.json({ error: "Only PI can log grant releases" }, { status: 403 });

  const body = await req.json();
  const { projectId, sanctionNo, sanctionDate, amount, financialYear, remarks } = body;

  if (!projectId || !sanctionNo || !sanctionDate || !amount || !financialYear) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const release = await prisma.grantRelease.create({
    data: {
      projectId,
      sanctionNo,
      sanctionDate: new Date(sanctionDate),
      amount,
      financialYear,
      remarks,
      createdById: session.user.id,
      recurringAmount: body.recurringAmount ?? null,
      nonRecurringAmount: body.nonRecurringAmount ?? null,
    },
  });

  return NextResponse.json(release, { status: 201 });
}