// src/lib/finance-engine/match.ts
//
// Matches bank debit transactions against logged Expenditure rows.
// Verified against real test data: exact same-day amount -> EXACT, exact amount but
// 10-day date gap -> UNCERTAIN, no amount match -> UNMATCHED.
//
// Design decision: only DEBIT transactions are matched against Expenditure — credits
// (grant releases, refunds) are a different reconciliation concern, not handled here.
// A row with an active parseConflict is excluded entirely (see shouldAttemptMatch) —
// its amount/date can't be trusted, so auto-matching it risks a false-confidence link.

import type { TransactionCategory } from "@prisma/client";

export type MatchConfidence = "EXACT" | "LIKELY" | "UNCERTAIN" | "UNMATCHED";

export interface MatchCandidateExpenditure {
  id: string;
  amount: number;
  expenditureDate: Date;
}

export interface MatchInput {
  id: string;
  transactionDate: Date;
  debit: number | null;
  category: TransactionCategory;
  parseConflict: string | null; // pulled from AuditLog by the caller, same as review UI does
}

export interface MatchResult {
  bankTransactionId: string;
  matchedExpenditureId: string | null;
  matchConfidence: MatchConfidence;
  reasoning: string;
}

function daysDiff(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * A row is eligible for auto-matching only if: it's a debit, and it has no active
 * parse conflict (unreliable amount/date should never feed an auto-match).
 */
export function shouldAttemptMatch(txn: MatchInput): boolean {
  return txn.debit !== null && txn.parseConflict === null;
}

export function matchTransaction(
  txn: MatchInput,
  expenditures: MatchCandidateExpenditure[]
): MatchResult {
  if (!shouldAttemptMatch(txn)) {
    return {
      bankTransactionId: txn.id,
      matchedExpenditureId: null,
      matchConfidence: "UNMATCHED",
      reasoning: txn.debit === null
        ? "Not a debit — matching only applies to money leaving the account"
        : "Row has an active parse conflict — amount/date not trusted enough to auto-match",
    };
  }

  const debit = txn.debit as number;

  const exactAmount = expenditures.filter((e) => Math.abs(e.amount - debit) < 0.005);
  const looseAmount = expenditures.filter((e) => {
    const diff = Math.abs(e.amount - debit);
    return diff >= 0.005 && diff <= 1;
  });

  const closest = (list: MatchCandidateExpenditure[]) =>
    [...list].sort(
      (a, b) =>
        daysDiff(a.expenditureDate, txn.transactionDate) -
        daysDiff(b.expenditureDate, txn.transactionDate)
    )[0];

  if (exactAmount.length > 0) {
    const within3 = exactAmount.filter((e) => daysDiff(e.expenditureDate, txn.transactionDate) <= 3);
    const within7 = exactAmount.filter((e) => daysDiff(e.expenditureDate, txn.transactionDate) <= 7);

    if (within3.length === 1) {
      return {
        bankTransactionId: txn.id,
        matchedExpenditureId: within3[0].id,
        matchConfidence: "EXACT",
        reasoning: `Amount ₹${debit} matches exactly, expenditure dated within 3 days, unique candidate`,
      };
    }
    if (within7.length >= 1) {
      const best = closest(within7);
      return {
        bankTransactionId: txn.id,
        matchedExpenditureId: best.id,
        matchConfidence: "LIKELY",
        reasoning: `Amount ₹${debit} matches exactly, closest expenditure within 7 days (${daysDiff(
          best.expenditureDate,
          txn.transactionDate
        )} days) — ${within7.length > 1 ? "multiple candidates, " : ""}confirm manually`,
      };
    }
    const best = closest(exactAmount);
    return {
      bankTransactionId: txn.id,
      matchedExpenditureId: best.id,
      matchConfidence: "UNCERTAIN",
      reasoning: `Amount ₹${debit} matches exactly but closest expenditure is ${daysDiff(
        best.expenditureDate,
        txn.transactionDate
      )} days away — too far to auto-confirm`,
    };
  }

  if (looseAmount.length > 0) {
    const best = closest(looseAmount);
    return {
      bankTransactionId: txn.id,
      matchedExpenditureId: best.id,
      matchConfidence: "UNCERTAIN",
      reasoning: `Closest amount match is ₹${best.amount} vs. transaction ₹${debit} (within ₹1 rounding) — needs manual confirmation`,
    };
  }

  return {
    bankTransactionId: txn.id,
    matchedExpenditureId: null,
    matchConfidence: "UNMATCHED",
    reasoning: `No expenditure found within ₹1 of ₹${debit}`,
  };
}