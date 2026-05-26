import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { projectId, budgetHeadId, amount, description, voucherNumber, date, expenditureDate } = body
    if (!projectId || !budgetHeadId || !amount || !description) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    const expenditure = await prisma.expenditure.create({
      data: {
        projectId,
        budgetHeadId,
        amount,
        description,
        voucherNumber: voucherNumber || null,
        expenditureDate: new Date(expenditureDate || date || Date.now()),
      },
      include: { budgetHead: true },
    })
    return NextResponse.json(expenditure, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Expenditure ID required' }, { status: 400 })
    await prisma.expenditure.delete({ where: { id } })
    return NextResponse.json({ message: 'Expenditure deleted' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}