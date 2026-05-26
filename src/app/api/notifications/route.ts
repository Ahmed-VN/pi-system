import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, markAllRead } = await req.json();

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
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
    console.error("Notifications PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.notification.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}