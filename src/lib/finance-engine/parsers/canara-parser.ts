// src/lib/finance-engine/parsers/canara-parser.ts
//
// Parses Canara Bank "e-Pass Sheet" PDF exports (text-based, not scanned).
//
// FIX (round 1): opening-balance header regex uses \s* instead of \s+ — real extraction
// sometimes glues "Opening Balance" directly onto the number with zero spaces.
//
// FIX (round 2): the trailing "<amount> <balance>" pair inside a row can also be glued
// with zero spaces ("140.001463.21") — that regex uses \s* too.
//
// FIX (round 3): amount/balance numbers are capped at 8 digits before the decimal, so a
// glued-on 10-16 digit UPI reference number can't get fully swallowed into the amount.
//
// FIX (round 4) — the big one: capping digits reduced the damage but didn't eliminate it
// (a reference number can still contribute its LAST few digits to the amount even with the
// cap). Real data showed this clearly: "PN22062614681434503.004544.92" should be a ₹4503.00
// credit, but text-extraction still parsed the amount as 81434503.00. The balance figure
// itself ("4544.92"), however, is always reliable — it's anchored to the true end of the
// row (right before the next date), so nothing can glue onto it from the wrong side.
//
// So this version flips the authority: for every row where the running balance is
// plausible, the actual debit/credit VALUE is derived from (balance − previous balance),
// not from the free-floating amount text. The extracted amount text is kept only as a
// cross-check — if it disagrees, the row is flagged for manual review, but the number
// actually stored is the one backed by the balance column, so reconciliation against the
// statement's own Dr/Cr footer works correctly by construction.
//
// FIX (round 4b) — chain-break cascade: when a row's structure can't be parsed at all
// (e.g. the PDF printed its date mid-narration instead of at the row start, which happens
// for a handful of rows in real exports), the code used to leave `prevBalance` frozen at
// its old value. Every row after that then computed a wrong delta against a stale
// baseline, producing a false "amount doesn't match balance delta" conflict on a row that
// was actually fine. A `chainBroken` flag now tracks this: the row immediately after a
// parse failure skips the delta cross-check (since the baseline is known-bad) and instead
// falls back to the narration's own /DR/ or /CR/ marker to decide debit vs. credit, then
// resumes the balance chain from its own (reliable) captured balance.

import type { BankStatementParser, ParsedStatement, ParsedTransaction } from "./types";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Ceiling for a plausible single balance figure — used only to detect a row where even the
// balance capture itself has clearly gone wrong (e.g. swallowed extra digits too).
const MAX_SANE_VALUE = 99_999_999.99; // ~10 crore ceiling — adjust if needed
const CONFLICT_EPSILON = 0.01;

function parseCanaraDate(dateStr: string): Date {
  // "15-Jun-2026"
  const [day, mon, year] = dateStr.split("-");
  const month = MONTHS[mon.toLowerCase()];
  if (month === undefined) throw new Error(`Unrecognized month in Canara date: ${dateStr}`);
  return new Date(Date.UTC(Number(year), month, Number(day)));
}

function num(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function canParse(rawText: string): boolean {
  return /Canara Bank/i.test(rawText) || /e-Pass Sheet/i.test(rawText);
}

function parse(rawText: string): ParsedStatement {
  const acctMatch = rawText.match(/Account Number:(\d+)/);
  if (!acctMatch) throw new Error("Canara parser: could not find Account Number");
  const accountNumber = acctMatch[1];

  const periodMatch = rawText.match(
    /period from (\d{2}-[A-Za-z]{3}-\d{4}) to (\d{2}-[A-Za-z]{3}-\d{4})/
  );
  if (!periodMatch) throw new Error("Canara parser: could not find statement period");
  const statementPeriodStart = parseCanaraDate(periodMatch[1]);
  const statementPeriodEnd = parseCanaraDate(periodMatch[2]);

  // Header "Opening Balance   1603.21" or "Opening Balance1603.21" (no colon) — distinct
  // from the footer's "Opening Balance:1603.21" (with colon), deliberately not matched here.
  const openingHeaderMatch = rawText.match(/Opening Balance\s*([\d,]+\.\d{2})/);
  if (!openingHeaderMatch) throw new Error("Canara parser: could not find opening balance header");
  const openingBalance = num(openingHeaderMatch[1]);
  const tableStart = openingHeaderMatch.index! + openingHeaderMatch[0].length;

  const footerMatch = rawText.match(
    /Opening Balance:([\d,.]+)\s*Dr Count:(\d+)\s*Dr Amount:([\d,.]+)[\s\S]*?Closing Balance:([\d,.]+)\s*Cr Count:(\d+)\s*Cr Amount:([\d,.]+)/
  );
  const expected = footerMatch
    ? {
        drCount: parseInt(footerMatch[2], 10),
        drAmount: num(footerMatch[3]),
        closingBalance: num(footerMatch[4]),
        crCount: parseInt(footerMatch[5], 10),
        crAmount: num(footerMatch[6]),
      }
    : null;

  const tableEnd = footerMatch ? rawText.indexOf("Opening Balance:", tableStart) : rawText.length;
  const transactionsText = rawText.slice(tableStart, tableEnd);

  // Row-start dates use a 4-digit year (DD-Mon-YYYY). Deliberately does NOT match the
  // 2-digit-year dates embedded inside SBINT narration (e.g. "28-MAR-26").
  const dateRegex = /\d{2}-[A-Za-z]{3}-\d{4}/g;
  const dateMatches = [...transactionsText.matchAll(dateRegex)];

  // Amount/balance number, capped at 8 digits before the decimal (plain) or comma-grouped.
  const NUMBER = "(?:\\d{1,3}(?:,\\d{2,3})+|\\d{1,8})\\.\\d{2}";
  const trailingRegex = new RegExp(`(${NUMBER})\\s*(${NUMBER})\\s*$`);

  const transactions: ParsedTransaction[] = [];
  let prevBalance = openingBalance;
  let chainBroken = false;

  for (let i = 0; i < dateMatches.length; i++) {
    const startIdx = dateMatches[i].index!;
    const endIdx = i + 1 < dateMatches.length ? dateMatches[i + 1].index! : transactionsText.length;
    const block = transactionsText.slice(startIdx, endIdx);
    const dateStr = dateMatches[i][0];
    const rest = block.slice(dateStr.length);

    const normalized = rest.replace(/\s+/g, " ").trim();
    const trailing = normalized.match(trailingRegex);

    // ── Case 1: couldn't even locate an amount/balance pair (usually a PDF layout quirk,
    // e.g. the date printed mid-narration instead of at the row start). Balance stays
    // unknown, so the chain is now unreliable for the next row too. ──
    if (!trailing) {
      transactions.push({
        transactionDate: parseCanaraDate(dateStr),
        narration: normalized,
        referenceNumber: null,
        debit: null,
        credit: null,
        balance: prevBalance,
        parseConflict: "Could not locate trailing amount + balance in this row",
      });
      chainBroken = true;
      continue;
    }

    const amountFromText = num(trailing[1]);
    const balance = num(trailing[2]);
    const narration = normalized.slice(0, trailing.index).trim();
    const chequeMatch = narration.match(/Cheque No\.:(\S*)/);
    const referenceNumber = chequeMatch && chequeMatch[1] ? chequeMatch[1] : null;
    const narrationSaysDr = /\/DR\//.test(narration);
    const narrationSaysCr = /\/CR\//.test(narration);

    // ── Case 2: even the balance figure looks implausible. Can't anchor anything from
    // this row; leave prevBalance untouched and keep the chain marked broken. ──
    if (Math.abs(balance) > MAX_SANE_VALUE) {
      transactions.push({
        transactionDate: parseCanaraDate(dateStr),
        narration,
        referenceNumber,
        debit: null,
        credit: null,
        balance: prevBalance,
        parseConflict: `Balance figure itself looks implausible (${balance}) — likely a parsing collision, row needs manual review`,
      });
      chainBroken = true;
      continue;
    }

    let debit: number | null = null;
    let credit: number | null = null;
    let parseConflict: string | null = null;

    if (chainBroken) {
      // Previous row(s) left us without a trustworthy baseline balance, so we can't use
      // the delta here. Fall back to the narration's own /DR//CR/ marker and trust the
      // extracted amount text directly for this one row.
      if (narrationSaysDr && !narrationSaysCr) {
        debit = amountFromText;
      } else if (narrationSaysCr && !narrationSaysDr) {
        credit = amountFromText;
      } else {
        parseConflict = "Could not reliably determine debit vs. credit for this row (it follows a row whose balance chain broke, and its narration has no clear /DR//CR/ marker) — needs manual review";
      }
      if (!parseConflict) {
        parseConflict = "This row follows a balance-chain break in an earlier row; debit/credit was inferred from its narration marker rather than the running balance — please verify";
      }
    } else {
      const delta = round2(balance - prevBalance);
      const deltaAmount = round2(Math.abs(delta));

      if (delta === 0) {
        parseConflict = "Zero balance delta — could not determine debit vs. credit";
      } else {
        // Trust the balance-derived amount — it's reconstructed from the statement's own
        // running balance, which can't be corrupted by a glued-on reference number the way
        // free-floating amount text can.
        if (delta < 0) {
          debit = deltaAmount;
        } else {
          credit = deltaAmount;
        }

        if (Math.abs(amountFromText - deltaAmount) > CONFLICT_EPSILON) {
          parseConflict = `Extracted amount text (₹${amountFromText}) didn't match the balance movement (₹${deltaAmount}); used ₹${deltaAmount} since the running balance is more reliable — please verify this row`;
        }
      }

      if (narrationSaysDr && credit !== null) {
        parseConflict = (parseConflict ? parseConflict + " " : "") + "Narration marked /DR/ but the balance delta computed a credit.";
      }
      if (narrationSaysCr && debit !== null) {
        parseConflict = (parseConflict ? parseConflict + " " : "") + "Narration marked /CR/ but the balance delta computed a debit.";
      }
    }

    transactions.push({
      transactionDate: parseCanaraDate(dateStr),
      narration,
      referenceNumber,
      debit,
      credit,
      balance,
      parseConflict,
    });
    prevBalance = balance;
    chainBroken = false;
  }

  const actualDebits = transactions.filter((t) => t.debit !== null);
  const actualCredits = transactions.filter((t) => t.credit !== null);
  const actualDebitCount = actualDebits.length;
  const actualDebitTotal = round2(actualDebits.reduce((s, t) => s + (t.debit ?? 0), 0));
  const actualCreditCount = actualCredits.length;
  const actualCreditTotal = round2(actualCredits.reduce((s, t) => s + (t.credit ?? 0), 0));
  const actualClosingBalance = transactions.length
    ? transactions[transactions.length - 1].balance
    : openingBalance;

  const balanced = expected
    ? actualDebitCount === expected.drCount &&
      actualDebitTotal === expected.drAmount &&
      actualCreditCount === expected.crCount &&
      actualCreditTotal === expected.crAmount &&
      actualClosingBalance === expected.closingBalance
    : false;

  return {
    bankName: "CANARA",
    accountNumber,
    statementPeriodStart,
    statementPeriodEnd,
    openingBalance,
    closingBalance: actualClosingBalance,
    transactions,
    reconciliation: {
      expectedDebitCount: expected?.drCount ?? null,
      expectedDebitTotal: expected?.drAmount ?? null,
      expectedCreditCount: expected?.crCount ?? null,
      expectedCreditTotal: expected?.crAmount ?? null,
      actualDebitCount,
      actualDebitTotal,
      actualCreditCount,
      actualCreditTotal,
      expectedClosingBalance: expected?.closingBalance ?? null,
      actualClosingBalance,
      balanced,
    },
  };
}

export const canaraParser: BankStatementParser = {
  bankName: "CANARA",
  canParse,
  parse,
};