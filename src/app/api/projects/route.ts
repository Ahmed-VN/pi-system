import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET all projects for logged in PI
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projects = await prisma.project.findMany({
      where: { piId: session.user.id },
      include: { milestones: true, personnelRecords: true, budgetHeads: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Projects GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create new project
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      title, shortTitle, grantType, sanctionNumber,
      startDate, endDate, hostInstitution, abstractText,
      totalBudget, budgetHeads,
    } = body

    // ANRF Rule: Max 8 projects per PI
    const totalProjects = await prisma.project.count({
      where: { piId: session.user.id, status: { in: ['ACTIVE', 'EXTENDED'] } },
    })

    if (totalProjects >= 8) {
      return NextResponse.json(
        { error: 'ANRF limit reached: Maximum 8 simultaneous projects allowed per investigator' },
        { status: 400 }
      )
    }

    // ANRF Rule: Max 4 ARG projects per PI
    if (grantType === 'ARG') {
      const argProjects = await prisma.project.count({
        where: { piId: session.user.id, grantType: 'ARG', status: { in: ['ACTIVE', 'EXTENDED'] } },
      })

      if (argProjects >= 4) {
        return NextResponse.json(
          { error: 'ANRF limit reached: Maximum 4 simultaneous ARG projects allowed' },
          { status: 400 }
        )
      }
    }

    // Create project with budget heads
    const project = await prisma.project.create({
      data: {
        title,
        shortTitle,
        grantType,
        sanctionNumber,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        hostInstitution,
        abstractText,
        totalBudget,
        piId: session.user.id,
        budgetHeads: {
          create: budgetHeads || [],
        },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error('Projects POST error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A project with this sanction number already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}