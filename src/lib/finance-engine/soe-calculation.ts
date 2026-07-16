// src/lib/finance-engine/soe-calculation.ts
//
// Matches the real SERB Annexure-II "Statement of Expenditure" format exactly:
// fixed canonical budget heads (Manpower/Consumables/Travel/Contingencies/Others/
// Equipment/Overhead), with Year-1 / Year-2 / Year-3-and-onward columns relative to
// the project's Date of Start (DOS), not just a single "this FY" figure.
//
// Verified: Year-bucket assignment and cumulative totals confirmed correct across
// two target FYs on synthetic multi-year expenditure data.

export const CANONICAL_HEADS = [
  "Manpower costs",
  "Consumables",
  "Travel",
  "Contingencies",
  "Others, if any",
  "Equipment",
  "Overhead expenses",
] as const;

export type CanonicalHead = (typeof CANONICAL_HEADS)[number];

/** Maps a user's free-text BudgetHead name to the fixed SERB category. */
export function mapToCanonicalHead(headName: string): CanonicalHead {
  const n = headName.toLowerCase();
  if (/manpower|personnel|salary|stipend|jrf|srf|research\s*fellow/.test(n)) return "Manpower costs";
  if (/consumable/.test(n)) return "Consumables";
  if (/travel/.test(n)) return "Travel";
  if (/conting/.test(n)) return "Contingencies";
  if (/equipment/.test(n)) return "Equipment";
  if (/overhead/.test(n)) return "Overhead expenses";
  return "Others, if any";
}

export function fyOf(date: Date): string {
  const y = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function fyRangeSOE(fy: string): { start: Date; end: Date } {
  const [y] = fy.split("-").map(Number);
  // Noon UTC, not end-of-day — end-of-day (23:59:59.999 UTC) rolls into the next
  // calendar day when displayed in timezones ahead of UTC (e.g. IST, UTC+5:30),
  // which is exactly what caused "31/03/2027" to display as "01/04/2027".
  return { start: new Date(Date.UTC(y, 3, 1, 12)), end: new Date(Date.UTC(y + 1, 2, 31, 12)) };
}

/** 1 = Year1 (DOS's own FY), 2 = Year2 (the next FY), 3 = Year3-and-onward (everything after). */
export function computeYearBucket(targetFY: string, dosDate: Date): 1 | 2 | 3 {
  const dosFY = fyOf(dosDate);
  const [dosStartYear] = dosFY.split("-").map(Number);
  const [targetStartYear] = targetFY.split("-").map(Number);
  const offset = targetStartYear - dosStartYear;
  if (offset <= 0) return 1;
  if (offset === 1) return 2;
  return 3;
}

export interface BudgetHeadForSOE {
  headName: string;
  allocatedAmount: number;
}

export interface ExpenditureForSOE {
  headName: string; // the budget head's name this expenditure belongs to
  amount: number;
  expenditureDate: Date;
}

export interface SOERowV2 {
  headName: CanonicalHead;
  sanctioned: number;
  year1: number;
  year2: number;
  year3plus: number;
  totalTillDate: number;
  balance: number;
  requirementNextYear: number;
}

export interface GrantReceivedByYear {
  year1: number;
  year2: number;
  year3: number;
  interest: number;
  total: number;
}

export interface SOEFiguresV2 {
  fy: string;
  dosDate: Date;
  asOnDate: Date;
  rows: SOERowV2[];
  totals: Omit<SOERowV2, "headName">;
  grantReceived: GrantReceivedByYear;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeSOEFiguresV2(
  fy: string,
  dosDate: Date,
  budgetHeads: BudgetHeadForSOE[],
  expenditures: ExpenditureForSOE[],
  grantReleasesByYearBucket: { amount: number; date: Date }[],
  interestThisFY: number
): SOEFiguresV2 {
  const { end: asOnDate } = fyRangeSOE(fy);

  const rows: SOERowV2[] = CANONICAL_HEADS.map((canon) => {
    const matchingHeads = budgetHeads.filter((bh) => mapToCanonicalHead(bh.headName) === canon);
    const sanctioned = round2(matchingHeads.reduce((s, bh) => s + bh.allocatedAmount, 0));

    const matchingExp = expenditures.filter((e) => mapToCanonicalHead(e.headName) === canon);

    let year1 = 0,
      year2 = 0,
      year3plus = 0;
    for (const e of matchingExp) {
      if (e.expenditureDate > asOnDate) continue; // don't count future-dated entries
      const bucket = computeYearBucket(fyOf(e.expenditureDate), dosDate);
      if (bucket === 1) year1 += e.amount;
      else if (bucket === 2) year2 += e.amount;
      else year3plus += e.amount;
    }
    year1 = round2(year1);
    year2 = round2(year2);
    year3plus = round2(year3plus);
    const totalTillDate = round2(year1 + year2 + year3plus);
    const balance = round2(sanctioned - totalTillDate);

    return {
      headName: canon,
      sanctioned,
      year1,
      year2,
      year3plus,
      totalTillDate,
      balance,
      // Best-effort suggestion, not a hard calculation — how much of the remaining
      // balance is being carried forward as next year's ask. Editable by the PI.
      requirementNextYear: balance > 0 ? balance : 0,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      sanctioned: acc.sanctioned + r.sanctioned,
      year1: acc.year1 + r.year1,
      year2: acc.year2 + r.year2,
      year3plus: acc.year3plus + r.year3plus,
      totalTillDate: acc.totalTillDate + r.totalTillDate,
      balance: acc.balance + r.balance,
      requirementNextYear: acc.requirementNextYear + r.requirementNextYear,
    }),
    { sanctioned: 0, year1: 0, year2: 0, year3plus: 0, totalTillDate: 0, balance: 0, requirementNextYear: 0 }
  );

  const grantByBucket = { year1: 0, year2: 0, year3: 0 };
  for (const g of grantReleasesByYearBucket) {
    const bucket = computeYearBucket(fyOf(g.date), dosDate);
    if (bucket === 1) grantByBucket.year1 += g.amount;
    else if (bucket === 2) grantByBucket.year2 += g.amount;
    else grantByBucket.year3 += g.amount;
  }

  return {
    fy,
    dosDate,
    asOnDate,
    rows,
    totals: {
      sanctioned: round2(totals.sanctioned),
      year1: round2(totals.year1),
      year2: round2(totals.year2),
      year3plus: round2(totals.year3plus),
      totalTillDate: round2(totals.totalTillDate),
      balance: round2(totals.balance),
      requirementNextYear: round2(totals.requirementNextYear),
    },
    grantReceived: {
      year1: round2(grantByBucket.year1),
      year2: round2(grantByBucket.year2),
      year3: round2(grantByBucket.year3),
      interest: round2(interestThisFY),
      total: round2(grantByBucket.year1 + grantByBucket.year2 + grantByBucket.year3 + interestThisFY),
    },
  };
}