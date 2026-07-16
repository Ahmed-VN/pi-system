// src/lib/finance-engine/parsers/sbi-parser.ts
//
// Parses SBI "Account Statement" PDF exports (text-based, not scanned).
//
// Written and verified against a REAL statement's pdf-parse output (not a screenshot).
// Two things the original placeholder version of this file got wrong, now confirmed
// against actual data:
//
// 1. It assumed empty Debit/Credit cells render as a literal "-" placeholder
//    ("debit-or-dash credit-or-dash balance"). Real flattened PDF text doesn't do that —
//    an empty cell just produces nothing, so a row only ever has ONE amount before the
//    balance, never two. Trying to match two amount-or-dash columns meant it could never
//    match a real row, which is why every SBI upload came back with 0 transactions.
//
// 2. SBI statements use Indian digit grouping (e.g. "18,05,111.00" — a group of 3, then
//    groups of 2), not Western grouping (groups of 3 throughout). The amount regex needs
//    to allow 2-or-3-digit comma groups, not just 3.
//
// Design decision (same one that worked for the Canara parser): rather than trying to
// infer debit vs. credit from column position — which real flattened PDF text doesn't
// preserve — debit/credit is derived from the balance movement (balance[i] - balance[i-1])
// and cross-checked against the extracted amount text. The balance figure is anchored to
// the true end of each row, so it's reliable even when other things about the row are
// messy. A `chainBroken` flag (same pattern as Canara) stops a single bad row from
// cascading false conflicts onto every row after it.
//
// Row shape confirmed from real data:
//   13/04/2023 13/04/2023 <narration text, may wrap across several lines> 99922 31,000.00 18,05,111.00
// i.e.: <Txn Date> <Value Date> <narration> <5-digit branch code> <one amount> <balance>

import type { BankStatementParser, ParsedStatement, ParsedTransaction } from "./types";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MAX_SANE_VALUE = 999_999_999.99; // SBI balances can legitimately run into crores
const CONFLICT_EPSILON = 0.01;

function parseSbiDate(dateStr: string): Date {
  // "13/04/2023" -> DD/MM/YYYY
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseSbiLongDate(dateStr: string): Date {
  // "1 Apr 2023" or "31 Mar 2024"
  const m = dateStr.trim().match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return new Date(NaN);
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return new Date(NaN);
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
}

function num(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function canParse(rawText: string): boolean {
  // IFS Code starting with SBIN is the most SBI-specific, least ambiguous signal available
  // in the extracted text (the logo is an image, so "SBI" alone isn't reliably present).
  return (
    /IFS Code\s*:?\s*SBIN/i.test(rawText) ||
    /\bSBIN\d{4,}\b/i.test(rawText) ||
    /State Bank of India/i.test(rawText)
  );
}

function parse(rawText: string): ParsedStatement {
  const acctMatch = rawText.match(/Account Number\s*:?\s*(\d+)/i);
  if (!acctMatch) throw new Error("SBI parser: could not find Account Number");
  const accountNumber = acctMatch[1];

  const periodMatch = rawText.match(
    /Account Statement from\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*to\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i
  );
  const statementPeriodStart = periodMatch ? parseSbiLongDate(periodMatch[1]) : new Date(NaN);
  const statementPeriodEnd = periodMatch ? parseSbiLongDate(periodMatch[2]) : new Date(NaN);

  const openingMatch = rawText.match(
    /Balance as on\s*\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*:?\s*([\d,]+\.\d{2})/i
  );
  if (!openingMatch) throw new Error("SBI parser: could not find opening balance");
  const openingBalance = num(openingMatch[1]);

  // Each row starts with two DD/MM/YYYY dates (Txn Date, Value Date), normally identical.
  // Real extraction glues them with zero spaces ("19/05/202219/05/2022"), so \s* (not \s+)
  // — same lesson as the Canara parser's "Opening Balance1603.21" case.
  const rowStartRegex = /(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/g;
  const rowMatches = [...rawText.matchAll(rowStartRegex)];

  // Amount/balance number: Indian comma grouping (groups of 2 or 3 after the first group),
  // capped so a long embedded reference number can't fully swallow into it.
  const NUMBER = "(?:\\d{1,3}(?:,\\d{2,3})+|\\d{1,8})\\.\\d{2}";
  // <5-digit branch code> <amount> <balance>, anchored to the true end of the row block.
  const trailingRegex = new RegExp(`(\\d{5})\\s*(${NUMBER})\\s*(${NUMBER})\\s*$`);

  // The column header reprints at the top of every page in a multi-page statement. When a
  // row falls right at a page break, that reprinted header text lands AFTER the row's own
  // amount/balance numbers (since we slice up to the next date match, which is now on the
  // next page). That pushes the real numbers away from the true end of the block and
  // breaks the $-anchored trailing match. Strip it out before matching.
  const HEADER_NOISE = /Txn\s*Date\s*Value\s*Date\s*Description\s*Ref\s*No\.?\s*\/?\s*Cheque\s*No\.?\s*Branch\s*Code\s*Debit\s*Credit\s*Balance/gi;
  const FOOTER_NOISE = /\*+\s*This is a computer generated statement.*/i;

  const transactions: ParsedTransaction[] = [];
  let prevBalance = openingBalance;
  let chainBroken = false;

  for (let i = 0; i < rowMatches.length; i++) {
    const startIdx = rowMatches[i].index!;
    const endIdx = i + 1 < rowMatches.length ? rowMatches[i + 1].index! : rawText.length;
    const block = rawText.slice(startIdx, endIdx);
    const txnDateStr = rowMatches[i][1];

    const afterDates = block.slice(rowMatches[i][0].length);
    const cleaned = afterDates.replace(HEADER_NOISE, " ").replace(FOOTER_NOISE, " ");
    const normalized = cleaned.replace(/\s+/g, " ").trim();
    const trailing = normalized.match(trailingRegex);

    // ── Case 1: couldn't locate branch code + amount + balance at all. ──
    if (!trailing) {
      transactions.push({
        transactionDate: parseSbiDate(txnDateStr),
        narration: normalized,
        referenceNumber: null,
        debit: null,
        credit: null,
        balance: prevBalance,
        parseConflict: "Could not locate branch code + amount + balance in this row",
      });
      chainBroken = true;
      continue;
    }

    const amountFromText = num(trailing[2]);
    const balance = num(trailing[3]);
    const narration = normalized.slice(0, trailing.index).trim();

    // Reference numbers appear inline in the narration (e.g. "CMP000000006362",
    // "AOIQ884650") with no clean delimiter — take the first letters+digits token as a
    // best-effort reference. Never guaranteed to be THE canonical ref, just a useful hint.
    const refMatch = narration.match(/\b([A-Z]{2,6}\d{4,})\b/);
    const referenceNumber = refMatch ? refMatch[1] : null;

    // ── Case 2: balance itself looks implausible. ──
    if (Math.abs(balance) > MAX_SANE_VALUE) {
      transactions.push({
        transactionDate: parseSbiDate(txnDateStr),
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
      // Unlike Canara's narration, SBI's description text has no reliable /DR//CR/-style
      // marker to fall back on, so once the chain is broken we genuinely can't determine
      // the sign safely. Flag for manual entry rather than guess.
      parseConflict =
        "This row follows a balance-chain break in an earlier row, and SBI narrations don't carry a reliable debit/credit marker to fall back on — please enter this row's debit/credit manually";
    } else {
      const delta = round2(balance - prevBalance);
      const deltaAmount = round2(Math.abs(delta));

      if (delta === 0) {
        parseConflict = "Zero balance delta — could not determine debit vs. credit";
      } else {
        // Trust the balance-derived amount, same reasoning as the Canara parser: the
        // balance is anchored to the true end of the row and can't be corrupted by a
        // glued-on reference number the way free-floating amount text can.
        if (delta < 0) {
          debit = deltaAmount;
        } else {
          credit = deltaAmount;
        }

        if (Math.abs(amountFromText - deltaAmount) > CONFLICT_EPSILON) {
          parseConflict = `Extracted amount text (₹${amountFromText}) didn't match the balance movement (₹${deltaAmount}); used ₹${deltaAmount} since the running balance is more reliable — please verify this row`;
        }
      }
    }

    transactions.push({
      transactionDate: parseSbiDate(txnDateStr),
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

  // SBI statements (per real sample) have no Dr/Cr summary footer like Canara's, so
  // "balanced" just means every row parsed cleanly with no flagged conflicts.
  const balanced = transactions.every((t) => t.parseConflict === null);

  return {
    bankName: "SBI",
    accountNumber,
    statementPeriodStart,
    statementPeriodEnd,
    openingBalance,
    closingBalance: actualClosingBalance,
    transactions,
    reconciliation: {
      expectedDebitCount: null,
      expectedDebitTotal: null,
      expectedCreditCount: null,
      expectedCreditTotal: null,
      actualDebitCount,
      actualDebitTotal,
      actualCreditCount,
      actualCreditTotal,
      expectedClosingBalance: null,
      actualClosingBalance,
      balanced,
    },
  };
}

export const sbiParser: BankStatementParser = {
  bankName: "SBI",
  canParse,
  parse,
};