// src/lib/finance-engine/parsers/types.ts

export type ParsedBankName = "CANARA" | "SBI";

export interface ParsedTransaction {
  transactionDate: Date;
  narration: string;
  referenceNumber: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
  /** Set when the parser's automated cross-checks disagree with each other on this row. */
  parseConflict: string | null;
}

export interface StatementReconciliation {
  expectedDebitCount: number | null;
  expectedDebitTotal: number | null;
  expectedCreditCount: number | null;
  expectedCreditTotal: number | null;
  actualDebitCount: number;
  actualDebitTotal: number;
  actualCreditCount: number;
  actualCreditTotal: number;
  expectedClosingBalance: number | null;
  actualClosingBalance: number;
  balanced: boolean;
}

export interface ParsedStatement {
  bankName: ParsedBankName;
  accountNumber: string;
  statementPeriodStart: Date;
  statementPeriodEnd: Date;
  openingBalance: number;
  closingBalance: number;
  transactions: ParsedTransaction[];
  reconciliation: StatementReconciliation;
}

export interface BankStatementParser {
  bankName: ParsedBankName;
  /** Sniff raw extracted PDF text for a bank-identifying signature string. */
  canParse(rawText: string): boolean;
  parse(rawText: string): ParsedStatement;
}
