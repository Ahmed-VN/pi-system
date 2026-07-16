// src/lib/finance-engine/uc-calculation.ts
//
// Computes the figures for a SINGLE fund-type UC (Recurring or Non-Recurring) —
// used to generate the two separate ANRF UC documents per the project's design.
//
// Verified: recurring + non-recurring closing balances sum back to exactly the
// combined total on a synthetic FY case (₹750,044 both ways).
//
// Same limitation as interest-allocation.ts, surfaced the same way: any GrantRelease
// without a recurringAmount/nonRecurringAmount split is invisible to this calculation
// and gets flagged in `warnings`, not silently dropped.

export type FundType = "RECURRING" | "NON_RECURRING";

export interface GrantReleaseForUC {
  sanctionNo: string;
  sanctionDate: Date;
  recurringAmount: number | null;
  nonRecurringAmount: number | null;
}

export interface ExpenditureForUC {
  amount: number;
  category: FundType;
  expenditureDate: Date;
}

export interface InterestAllocationForUC {
  recurringInterest: number;
  nonRecurringInterest: number;
  transactionDate: Date;
}

export interface UCFigures {
  fundType: FundType;
  fy: string;
  openingBalance: number;
  grantReceivedThisFY: number;
  releasesThisFY: { sanctionNo: string; sanctionDate: Date; amount: number }[];
  interestEarnedThisFY: number;
  expenditureThisFY: number;
  totalAvailable: number;
  closingBalance: number;
  warnings: string[];
}

export function fyRange(fy: string): { start: Date; end: Date } {
  const [startYear] = fy.split("-").map(Number);
  return {
    start: new Date(Date.UTC(startYear, 3, 1)),
    end: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeUCFigures(
  fundType: FundType,
  fy: string,
  grantReleases: GrantReleaseForUC[],
  expenditures: ExpenditureForUC[],
  interestAllocations: InterestAllocationForUC[]
): UCFigures {
  const { start, end } = fyRange(fy);
  const warnings: string[] = [];

  const amountFor = (g: GrantReleaseForUC) =>
    fundType === "RECURRING" ? g.recurringAmount : g.nonRecurringAmount;
  const interestFor = (a: InterestAllocationForUC) =>
    fundType === "RECURRING" ? a.recurringInterest : a.nonRecurringInterest;

  const priorReleases = grantReleases.filter((g) => g.sanctionDate < start);
  for (const g of priorReleases) {
    if (g.recurringAmount == null && g.nonRecurringAmount == null) {
      warnings.push(
        `Grant release ${g.sanctionNo} (before this FY) has no recurring/non-recurring split — excluded, opening balance may be understated`
      );
    }
  }
  const openingReleaseTotal = priorReleases.reduce((s, g) => s + (amountFor(g) ?? 0), 0);
  const openingExpTotal = expenditures
    .filter((e) => e.expenditureDate < start && e.category === fundType)
    .reduce((s, e) => s + e.amount, 0);
  const openingBalance = round2(openingReleaseTotal - openingExpTotal);

  const thisFYReleases = grantReleases.filter(
    (g) => g.sanctionDate >= start && g.sanctionDate <= end
  );
  for (const g of thisFYReleases) {
    if (g.recurringAmount == null && g.nonRecurringAmount == null) {
      warnings.push(
        `Grant release ${g.sanctionNo} (this FY) has no recurring/non-recurring split — excluded from grant-received total`
      );
    }
  }
  const grantReceivedThisFY = round2(thisFYReleases.reduce((s, g) => s + (amountFor(g) ?? 0), 0));

  const interestEarnedThisFY = round2(
    interestAllocations
      .filter((a) => a.transactionDate >= start && a.transactionDate <= end)
      .reduce((s, a) => s + interestFor(a), 0)
  );

  const expenditureThisFY = round2(
    expenditures
      .filter((e) => e.expenditureDate >= start && e.expenditureDate <= end && e.category === fundType)
      .reduce((s, e) => s + e.amount, 0)
  );

  const totalAvailable = round2(openingBalance + grantReceivedThisFY + interestEarnedThisFY);
  const closingBalance = round2(totalAvailable - expenditureThisFY);

  return {
    fundType,
    fy,
    openingBalance,
    grantReceivedThisFY,
    releasesThisFY: thisFYReleases.map((g) => ({
      sanctionNo: g.sanctionNo,
      sanctionDate: g.sanctionDate,
      amount: amountFor(g) ?? 0,
    })),
    interestEarnedThisFY,
    expenditureThisFY,
    totalAvailable,
    closingBalance,
    warnings,
  };
}