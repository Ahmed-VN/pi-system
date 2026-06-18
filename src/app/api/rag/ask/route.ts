import { NextRequest, NextResponse } from "next/server";
import { queryDocuments } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const { projectId, question } = await req.json();

    if (!projectId || !question) {
      return NextResponse.json({ error: "projectId and question are required" }, { status: 400 });
    }

    const answer = await queryDocuments(projectId, question);
    return NextResponse.json({ answer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}