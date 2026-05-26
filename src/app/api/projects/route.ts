import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ─── GET /api/projects ────────────────────────────────────────────────────────
// Returns all projects the logged-in user is associated with (PI, CO-PI, JRF)

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { pi: { email: session.user.email! } },
        { personnelRecords: { some: { user: { email: session.user.email! } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      shortTitle: true,
      sanctionNumber: true,
      grantType: true,
      status: true,
      totalBudget: true,
      startDate: true,
      endDate: true,
      hostInstitution: true,
    },
  });

  const serialized = projects.map((p) => ({
    ...p,
    totalBudget: Number(p.totalBudget),
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
  }));

  return NextResponse.json(serialized);
}

// ─── POST /api/projects ───────────────────────────────────────────────────────
// Create a new project — PI only (ANRF business rules enforced)

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only PIs can create projects
  if (user.role !== "PI") {
    return NextResponse.json({ error: "Only Principal Investigators can create projects" }, { status: 403 });
  }

  const body = await req.json();
  const { title, grantType, sanctionNumber, startDate, endDate, hostInstitution, totalBudget, abstractText } = body;

  if (!title || !grantType || !sanctionNumber || !startDate || !endDate || !hostInstitution || !totalBudget) {
    return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
  }

  // ANRF rule: max 8 active/extended projects per PI
  const activeCount = await prisma.project.count({
    where: { piId: user.id, status: { in: ["ACTIVE", "EXTENDED"] } },
  });
  if (activeCount >= 8) {
    return NextResponse.json({ error: "Maximum of 8 active projects allowed" }, { status: 400 });
  }

  // ANRF rule: max 4 ARG projects per PI
  if (grantType === "ARG") {
    const argCount = await prisma.project.count({ where: { piId: user.id, grantType: "ARG" } });
    if (argCount >= 4) {
      return NextResponse.json({ error: "Maximum of 4 ARG projects allowed" }, { status: 400 });
    }
  }

  const project = await prisma.project.create({
    data: {
      title,
      grantType,
      sanctionNumber,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      hostInstitution,
      totalBudget,
      abstractText: abstractText || null,
      piId: user.id,
    },
  });

  return NextResponse.json({
    ...project,
    totalBudget: Number(project.totalBudget),
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }, { status: 201 });
}