// src/lib/finance-engine/parsers/registry.ts

import { canaraParser } from "./canara-parser";
import { sbiParser } from "./sbi-parser";
import type { BankStatementParser, ParsedBankName, ParsedStatement } from "./types";

const parsers: BankStatementParser[] = [canaraParser, sbiParser];

export function detectAndParse(rawText: string): ParsedStatement {
  const match = parsers.find((p) => p.canParse(rawText));
  if (!match) {
    throw new Error(
      "Could not identify the bank from this statement. Supported banks: Canara, SBI."
    );
  }
  return match.parse(rawText);
}

export function parseWithBank(bankName: ParsedBankName, rawText: string): ParsedStatement {
  const parser = parsers.find((p) => p.bankName === bankName);
  if (!parser) throw new Error(`No parser registered for ${bankName}`);
  return parser.parse(rawText);
}

export { canaraParser, sbiParser };