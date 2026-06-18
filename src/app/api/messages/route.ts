import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const threads = await prisma.thread.findMany({
    where: { projectId },
    include: {
      messages: {
        include: {
          sender: { select: { id: true, name: true, role: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(threads)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, content, messageType = 'CHAT', threadId, parentId, attachments } = await req.json()

  if (!projectId || (!content && (!attachments || attachments.length === 0))) {
    return NextResponse.json({ error: 'projectId and content or attachment required' }, { status: 400 })
  }

  let thread

  if (threadId) {
    thread = await prisma.thread.findUnique({ where: { id: threadId } })
  } else if (messageType === 'DAILY_REPORT' || messageType === 'FEEDBACK') {
    thread = await prisma.thread.findFirst({ where: { projectId, title: 'Daily Reports' } })
    if (!thread) thread = await prisma.thread.create({ data: { projectId, title: 'Daily Reports' } })
  } else {
    thread = await prisma.thread.findFirst({ where: { projectId, title: 'General Chat' } })
    if (!thread) thread = await prisma.thread.create({ data: { projectId, title: 'General Chat' } })
  }

  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: session.user.id,
      content: content || '',
      messageType,
      parentId: parentId || null,
      attachments: attachments?.length
        ? {
            create: attachments.map((a: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }) => ({
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              fileSize: a.fileSize,
              mimeType: a.mimeType,
            })),
          }
        : undefined,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      attachments: true,
    },
  })

  await prisma.thread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } })

  return NextResponse.json({ thread, message }, { status: 201 })
}