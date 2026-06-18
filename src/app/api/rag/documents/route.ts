import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import fs from "fs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "uploaded_docs", projectId);

    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({ documents: [] });
    }

    const files = await readdir(uploadDir);
    return NextResponse.json({ documents: files });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}