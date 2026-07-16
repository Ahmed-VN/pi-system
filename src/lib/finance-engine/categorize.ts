// src/lib/finance-engine/categorize.ts
//
// Applies DB-stored CategorizationRule rows to a transaction's narration.
// Deliberately NOT hardcoded — rules are fetched from the CategorizationRule table
// (seeded in Phase 1) so they can be edited/extended without a code change.

import { prisma } from "@/lib/prisma";
import type { TransactionCategory } from "@prisma/client";

export interface CategorizationResult {
  category: TransactionCategory;
  matchedRuleId: string | null;
  matchedKeyword: string | null;
}

/**
 * Fetch all active rules once per statement-import (not per-transaction) and reuse —
 * call loadActiveRules() in the caller, then pass the result into categorizeNarration()
 * for every transaction in that statement. Avoids N+1 queries.
 */
export async function loadActiveRules() {
  return prisma.categorizationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });
}

export type ActiveRule = Awaited<ReturnType<typeof loadActiveRules>>[number];

export function categorizeNarration(
  narration: string,
  rules: ActiveRule[]
): CategorizationResult {
  const upperNarration = narration.toUpperCase();

  // Rules are pre-sorted by priority desc; first keyword match wins.
  for (const rule of rules) {
    if (upperNarration.includes(rule.keyword.toUpperCase())) {
      return {
        category: rule.category,
        matchedRuleId: rule.id,
        matchedKeyword: rule.keyword,
      };
    }
  }

  return { category: "UNCATEGORIZED", matchedRuleId: null, matchedKeyword: null };
}