import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET personnel for a project
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 })

    const personnel = await prisma.personnelRecord.findMany({
      where: { projectId },
      include: { user: true },
    })

    return NextResponse.json(personnel)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST add team member
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { projectId, email, role, joinDate, stipend } = body

    if (!projectId || !email || !role) {
      return NextResponse.json({ error: 'Project ID, email and role are required' }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'No user found with this email' }, { status: 404 })
    }

    const record = await prisma.personnelRecord.create({
      data: {
        projectId,
        userId: user.id,
        role,
        joinDate: new Date(joinDate || Date.now()),
        stipend: stipend || null,
      },
      include: { user: true },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'This person is already in the project' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE remove team member
export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Record ID required' }, { status: 400 })

    await prisma.personnelRecord.delete({ where: { id } })

    return NextResponse.json({ message: 'Team member removed' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}