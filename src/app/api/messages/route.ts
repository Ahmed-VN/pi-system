import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/messages?projectId=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const threads = await prisma.thread.findMany({
    where: { projectId },
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(threads)
}

// POST /api/messages
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, content, messageType = 'CHAT', threadId, parentId } = await req.json()

  if (!projectId || !content) {
    return NextResponse.json({ error: 'projectId and content required' }, { status: 400 })
  }

  let thread

  if (threadId) {
    // Use the explicitly provided thread
    thread = await prisma.thread.findUnique({ where: { id: threadId } })
  } else if (messageType === 'DAILY_REPORT' || messageType === 'FEEDBACK') {
    // Daily reports and feedback always go into a single shared "Daily Reports" thread per project
    thread = await prisma.thread.findFirst({
      where: { projectId, title: 'Daily Reports' },
    })
    if (!thread) {
      thread = await prisma.thread.create({
        data: { projectId, title: 'Daily Reports' },
      })
    }
  } else {
    // CHAT: find the single existing General Chat thread, or create it once
    thread = await prisma.thread.findFirst({
      where: { projectId, title: 'General Chat' },
    })
    if (!thread) {
      thread = await prisma.thread.create({
        data: { projectId, title: 'General Chat' },
      })
    }
  }

  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: session.user.id,
      content,
      messageType,
      parentId: parentId || null,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  })

  await prisma.thread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  })

  return NextResponse.json({ thread, message }, { status: 201 })
}