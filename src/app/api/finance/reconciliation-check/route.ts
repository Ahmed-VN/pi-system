// src/app/api/finance/reconciliation-check/route.ts
//
// GET: check whether this project's bank data is clean enough to generate a UC.
// Wire this into the UC generation dialog — call it when the dialog opens, and
// block the "Generate & Download" button if canGenerateUC is false.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkReconciliation } from "@/lib/finance-engine/reconciliation-guard";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const result = await checkReconciliation(projectId);
  return NextResponse.json(result);
}