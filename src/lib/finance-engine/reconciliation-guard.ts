// src/lib/finance-engine/reconciliation-guard.ts
//
// Checks run BEFORE UC generation is allowed to proceed. Scope, honestly stated:
// this covers statement-parsing health, unresolved parse conflicts, and interest
// allocation warnings — NOT the full "opening + receipts - expenditure = closing"
// ledger-vs-bank cross-check described in the original spec, which needs the
// FY-chained FinancialSnapshot model (not yet built) to do properly. This is a
// real, useful v1 guard, not the complete picture yet.

import { prisma } from "@/lib/prisma";

export interface ReconciliationCheckResult {
  canGenerateUC: boolean;
  blockers: string[];
  warnings: string[];
}

export async function checkReconciliation(projectId: string): Promise<ReconciliationCheckResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const statements = await prisma.bankStatement.findMany({
    where: { projectId },
    select: { id: true, bankName: true, parsingStatus: true, accountNumber: true },
  });

  if (statements.length === 0) {
    warnings.push("No bank statements uploaded for this project — UC will rely entirely on manually entered interest figures.");
  }

  for (const s of statements) {
    if (s.parsingStatus === "NEEDS_REVIEW") {
      blockers.push(
        `${s.bankName} statement (${s.accountNumber}) has rows flagged for review — resolve them in the Category Review screen first.`
      );
    }
    if (s.parsingStatus === "FAILED") {
      blockers.push(`${s.bankName} statement (${s.accountNumber}) failed to parse — re-upload it.`);
    }
    if (s.parsingStatus === "PENDING") {
      blockers.push(`${s.bankName} statement (${s.accountNumber}) hasn't finished processing yet.`);
    }
  }

  const statementIds = statements.map((s) => s.id);
  if (statementIds.length > 0) {
    const interestTxns = await prisma.bankTransaction.findMany({
      where: { statementId: { in: statementIds }, category: "INTEREST" },
      select: { id: true, interestAllocation: { select: { id: true } } },
    });
    const unallocated = interestTxns.filter((t) => !t.interestAllocation);
    if (unallocated.length > 0) {
      blockers.push(
        `${unallocated.length} interest transaction(s) haven't had interest allocation run yet — click "Run Interest Allocation" on the affected statement(s).`
      );
    }

    const conflictLogs = await prisma.auditLog.count({
      where: {
        entityType: "InterestAllocation",
        action: "INTEREST_ALLOCATE",
        formulaUsed: { contains: "WARNING:" },
        projectId,
      },
    });
    if (conflictLogs > 0) {
      warnings.push(
        `${conflictLogs} interest allocation(s) were computed with a data-quality warning (see Audit Log) — likely legacy grant releases missing a recurring/non-recurring split. Review before trusting the figures.`
      );
    }
  }

  const unsplitReleases = await prisma.grantRelease.findMany({
    where: { projectId, recurringAmount: null, nonRecurringAmount: null },
    select: { sanctionNo: true },
  });
  if (unsplitReleases.length > 0) {
    blockers.push(
      `${unsplitReleases.length} grant release(s) are missing a recurring/non-recurring split (${unsplitReleases
        .map((r) => r.sanctionNo)
        .join(", ")}) — required to generate separate Recurring and Non-Recurring UCs. Edit them first.`
    );
  }

  return {
    canGenerateUC: blockers.length === 0,
    blockers,
    warnings,
  };
}