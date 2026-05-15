import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET expenditures for a project
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 })

    const expenditures = await prisma.expenditure.findMany({
      where: { projectId },
      include: { budgetHead: true },
      orderBy: { expenditureDate: 'desc' },
    })

    return NextResponse.json(expenditures)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST add expenditure
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { projectId, budgetHeadId, amount, description, voucherNumber, expenditureDate } = body

    if (!projectId || !budgetHeadId || !amount || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const expenditure = await prisma.expenditure.create({
      data: {
        projectId,
        budgetHeadId,
        amount,
        description,
        voucherNumber,
        expenditureDate: new Date(expenditureDate || Date.now()),
      },
      include: { budgetHead: true },
    })

    return NextResponse.json(expenditure, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}