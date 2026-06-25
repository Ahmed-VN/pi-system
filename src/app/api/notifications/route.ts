import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

async function seedExpiryNotifications(userId: string) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringDocs = await prisma.document.findMany({
    where: {
      expiryDate: { lte: in7Days },
      project: {
        OR: [
          { piId: userId },
          { personnelRecords: { some: { userId } } },
        ],
      },
    },
    include: { project: { select: { id: true, title: true } } },
  });

  for (const doc of expiringDocs) {
    const diff = Math.ceil(
      (new Date(doc.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const message =
      diff < 0
        ? `Expired ${Math.abs(diff)} day(s) ago`
        : diff === 0
        ? 'Expires today'
        : `Expires in ${diff} day(s)`;

    const key = `expiry-${doc.id}`;

    // Skip if user already dismissed this notification
    const dismissed = await prisma.notification.findFirst({
      where: { userId, title: key, type: 'DISMISSED' },
    });
    if (dismissed) continue;

    const existing = await prisma.notification.findFirst({
      where: { userId, title: key, type: 'EXPIRY' },
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          userId,
          title: key,
          message: `📄 "${doc.title}" in "${doc.project.title}" — ${message}`,
          link: `/dashboard/projects/${doc.project.id}`,
          type: 'EXPIRY',
          read: false,
        },
      });
    }
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await seedExpiryNotifications(session.user.id);

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: { not: 'DISMISSED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: session.user.id,
        read: false,
        type: { not: 'DISMISSED' },
      },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, markAllRead } = await req.json();

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false, type: { not: 'DISMISSED' } },
        data: { read: true },
      });
    } else if (id) {
      await prisma.notification.update({
        where: { id },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Mark EXPIRY notifications as DISMISSED so they don't re-seed
    await prisma.notification.updateMany({
      where: { userId: session.user.id, type: 'EXPIRY' },
      data: { type: 'DISMISSED' },
    });

    // Delete any other non-dismissed notifications
    await prisma.notification.deleteMany({
      where: { userId: session.user.id, type: { not: 'DISMISSED' } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}