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
    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: 'asc' },
    })
    return NextResponse.json(milestones)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { projectId, title, description, dueDate } = body
    if (!projectId || !title || !dueDate) {
      return NextResponse.json({ error: 'Project ID, title and due date are required' }, { status: 400 })
    }
    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        title,
        description,
        dueDate: new Date(dueDate),
        createdById: session.user.id,
      },
    })
    return NextResponse.json(milestone, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { id, status } = body
    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    })
    return NextResponse.json(milestone)
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
    if (!id) return NextResponse.json({ error: 'Milestone ID required' }, { status: 400 })
    await prisma.milestone.delete({ where: { id } })
    return NextResponse.json({ message: 'Milestone deleted' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}