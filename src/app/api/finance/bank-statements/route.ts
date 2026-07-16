// src/app/api/finance/bank-statements/route.ts
//
// POST: upload a PDF, parse it, persist BankStatement + BankTransaction rows,
//       auto-categorize each transaction, write AuditLog entries.
// GET:  list statements for a project.
//
// Replaces the throwaway Phase 2 test-parse route — that one never touched the
// database. This is the real thing.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import pdf from "pdf-parse";
import { prisma } from "@/lib/prisma";
import { detectAndParse, parseWithBank } from "@/lib/finance-engine/parsers/registry";
import { loadActiveRules, categorizeNarration } from "@/lib/finance-engine/categorize";
import type { ParsedBankName } from "@/lib/finance-engine/parsers/types";

// Any single amount/balance above this is almost certainly a mis-parsed row
// (digits from a reference number or account number fused onto the real amount
// because the PDF text extraction didn't put a space where we expected one).
// Adjust upward if you have genuinely large grant transactions.
const MAX_SANE_VALUE = 99_999_999.99; // ~10 crore ceiling

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const statements = await prisma.bankStatement.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      statementPeriodStart: true,
      statementPeriodEnd: true,
      parsingStatus: true,
      openingBalance: true,
      closingBalance: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json({
    statements: statements.map((s) => ({
      ...s,
      openingBalance: s.openingBalance ? Number(s.openingBalance) : null,
      closingBalance: s.closingBalance ? Number(s.closingBalance) : null,
      transactionCount: s._count.transactions,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;
  const bankOverride = formData.get("bank") as ParsedBankName | null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "file and projectId are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // ── 1. Extract text ──
  let rawText: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdf(buffer);
    rawText = result.text;

    if (process.env.DEBUG_BANK_PARSE === "1") {
      console.log("=== RAW TEXT DEBUG (full) ===");
      console.log(rawText);
      console.log("=== END DEBUG ===");
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to extract text from PDF", detail: String(err) },
      { status: 500 }
    );
  }

  // ── 2. Parse ──
  let parsed;
  try {
    parsed = bankOverride ? parseWithBank(bankOverride, rawText) : detectAndParse(rawText);
  } catch (err) {
    return NextResponse.json({ error: "Parsing failed", detail: String(err) }, { status: 422 });
  }

  // ── 2b. Sanity-check every row BEFORE touching the database. ──
  // A value this large means a regex mismatch fused extra digits (reference
  // numbers, account numbers, dates) into the amount/balance. Flag it for
  // review instead of letting Postgres reject the whole transaction later.
  for (const t of parsed.transactions) {
    const suspects = [t.debit, t.credit, t.balance].filter(
      (v): v is number => v !== null && Math.abs(v) > MAX_SANE_VALUE
    );
    if (suspects.length > 0) {
      console.warn("SUSPECT ROW (value too large, needs regex review):", {
        date: t.transactionDate,
        narration: t.narration,
        debit: t.debit,
        credit: t.credit,
        balance: t.balance,
      });
      t.debit = null;
      t.credit = null;
      t.parseConflict = `Suspiciously large amount/balance parsed (debit=${t.debit ?? "—"}, credit=${t.credit ?? "—"}, balance=${t.balance}) — likely regex mismatch, needs manual review`;
    }
  }

  const hasConflicts = parsed.transactions.some((t) => t.parseConflict !== null);
  const parsingStatus = hasConflicts || !parsed.reconciliation.balanced ? "NEEDS_REVIEW" : "PARSED";

  // ── 3. Load categorization rules once, reuse for every transaction in this statement ──
  const rules = await loadActiveRules();

  // ── 4. Persist statement + transactions + audit log in one transaction ──
  // NOTE: file storage (originalFileUrl) is a placeholder path here — wire this to
  // wherever your existing Document upload flow stores files (same pattern as
  // Document.fileUrl elsewhere in this codebase) before shipping.
  const created = await prisma.$transaction(async (tx) => {
    const statement = await tx.bankStatement.create({
      data: {
        projectId,
        bankName: parsed.bankName,
        accountNumber: parsed.accountNumber,
        statementPeriodStart: parsed.statementPeriodStart,
        statementPeriodEnd: parsed.statementPeriodEnd,
        uploadedById: session.user.id,
        originalFileUrl: `/uploads/bank-statements/${Date.now()}-${file.name}`,
        parsingStatus,
        parsingErrors: hasConflicts
          ? `${parsed.transactions.filter((t) => t.parseConflict).length} row(s) flagged for review`
          : null,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
      },
    });

    for (const t of parsed.transactions) {
      const { category, matchedRuleId, matchedKeyword } = categorizeNarration(t.narration, rules);

      const bankTransaction = await tx.bankTransaction.create({
        data: {
          statementId: statement.id,
          projectId,
          transactionDate: t.transactionDate,
          narration: t.narration,
          referenceNumber: t.referenceNumber,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
          category,
        },
      });

      await tx.auditLog.create({
        data: {
          projectId,
          entityType: "BankTransaction",
          entityId: bankTransaction.id,
          action: "AUTO_CATEGORIZE",
          formulaUsed: matchedRuleId
            ? `Matched keyword "${matchedKeyword}" -> ${category}`
            : "No rule matched -> UNCATEGORIZED",
          performedById: session.user.id,
        },
      });

      if (t.parseConflict) {
        await tx.auditLog.create({
          data: {
            projectId,
            entityType: "BankTransaction",
            entityId: bankTransaction.id,
            action: "PARSE_CONFLICT_FLAGGED",
            formulaUsed: t.parseConflict,
            performedById: session.user.id,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        projectId,
        entityType: "BankStatement",
        entityId: statement.id,
        action: "STATEMENT_PARSED",
        formulaUsed: `${parsed.transactions.length} transactions, reconciliation ${
          parsed.reconciliation.balanced ? "balanced" : "NOT balanced"
        }`,
        performedById: session.user.id,
      },
    });

    return statement;
  });

  return NextResponse.json({
    success: true,
    statementId: created.id,
    parsingStatus,
    transactionCount: parsed.transactions.length,
    reconciliation: parsed.reconciliation,
  });
}