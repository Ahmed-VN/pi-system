import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const document = await prisma.document.findFirst({
      where: { id, uploadedById: session.user.id },
    });

    if (!document)
      return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const filePath = path.join(process.cwd(), "public", document.fileUrl);
    if (existsSync(filePath)) await unlink(filePath);

    await prisma.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const document = await prisma.document.findFirst({
      where: { id, uploadedById: session.user.id },
      include: {
        project: { select: { title: true, sanctionNumber: true } },
      },
    });

    if (!document)
      return NextResponse.json({ error: "Document not found" }, { status: 404 });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Document GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}