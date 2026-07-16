// src/lib/finance-engine/interest-allocation.ts
//
// Pro-rata interest split between recurring/non-recurring, using the running balance
// immediately before each interest credit — per ANRF requirement (NOT split using
// sanctioned amount ratio, which was explicitly ruled out in this project's design).
//
// Verified: on a clean synthetic case (recurring balance 250,000 / non-recurring
// 500,000 before a ₹44 interest credit), correctly split ₹14.67 / ₹29.33 — sums back
// to exactly ₹44.00.
//
// IMPORTANT LIMITATION, surfaced via the `warning` field rather than hidden:
// this calculation is only as good as your GrantRelease.recurringAmount/nonRecurringAmount
// data. Any GrantRelease before the interest date with both fields null (i.e. logged
// before Phase 1's schema update, or never split) means that release's money is
// invisible to this balance calculation — understating both sides. The warning field
// flags this so a human decides whether to fix the source data or proceed anyway.

export interface GrantReleaseForAllocation {
  recurringAmount: number | null;
  nonRecurringAmount: number | null;
  sanctionDate: Date;
}

export interface ExpenditureForAllocation {
  amount: number;
  category: "RECURRING" | "NON_RECURRING";
  expenditureDate: Date;
}

export interface InterestTransactionInput {
  id: string;
  transactionDate: Date;
  credit: number;
}

export interface AllocationResult {
  bankTransactionId: string;
  recurringInterest: number;
  nonRecurringInterest: number;
  recurringBalanceBefore: number;
  nonRecurringBalanceBefore: number;
  warning: string | null;
}

export function allocateInterest(
  txn: InterestTransactionInput,
  grantReleases: GrantReleaseForAllocation[],
  expenditures: ExpenditureForAllocation[]
): AllocationResult {
  const before = (d: Date) => d.getTime() < txn.transactionDate.getTime();

  const releasesBefore = grantReleases.filter((g) => before(g.sanctionDate));

  const recurringBalanceBefore =
    releasesBefore.reduce((s, g) => s + (g.recurringAmount ?? 0), 0) -
    expenditures
      .filter((e) => e.category === "RECURRING" && before(e.expenditureDate))
      .reduce((s, e) => s + e.amount, 0);

  const nonRecurringBalanceBefore =
    releasesBefore.reduce((s, g) => s + (g.nonRecurringAmount ?? 0), 0) -
    expenditures
      .filter((e) => e.category === "NON_RECURRING" && before(e.expenditureDate))
      .reduce((s, e) => s + e.amount, 0);

  const totalBefore = recurringBalanceBefore + nonRecurringBalanceBefore;

  const unsplitReleases = releasesBefore.filter(
    (g) => g.recurringAmount == null && g.nonRecurringAmount == null
  );

  let warning: string | null = null;
  if (unsplitReleases.length > 0) {
    warning = `${unsplitReleases.length} grant release(s) before this date have no recurring/non-recurring split logged — balances may be understated. Update those GrantRelease rows before trusting this allocation.`;
  } else if (totalBefore <= 0) {
    warning =
      "Total balance before this interest credit is zero or negative — cannot compute a meaningful split. Needs manual review.";
  }

  if (totalBefore <= 0) {
    return {
      bankTransactionId: txn.id,
      recurringInterest: 0,
      nonRecurringInterest: 0,
      recurringBalanceBefore,
      nonRecurringBalanceBefore,
      warning,
    };
  }

  const recurringInterest = Math.round((txn.credit * (recurringBalanceBefore / totalBefore)) * 100) / 100;
  // Non-recurring gets the remainder, not its own independent rounding — guarantees the
  // two always sum to exactly the original interest amount (standard accounting practice
  // for splitting a rounded total).
  const nonRecurringInterest = Math.round((txn.credit - recurringInterest) * 100) / 100;

  return {
    bankTransactionId: txn.id,
    recurringInterest,
    nonRecurringInterest,
    recurringBalanceBefore,
    nonRecurringBalanceBefore,
    warning,
  };
}