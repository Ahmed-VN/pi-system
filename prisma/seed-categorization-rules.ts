// prisma/seed-categorization-rules.ts
// Run manually: npx tsx prisma/seed-categorization-rules.ts
// Safe to re-run — upserts on keyword, never duplicates.

import { PrismaClient, TransactionCategory } from "@prisma/client";

const prisma = new PrismaClient();

const rules: { keyword: string; category: TransactionCategory; priority: number }[] = [
  { keyword: "SBINT", category: "INTEREST", priority: 10 },
  { keyword: "SB INT", category: "INTEREST", priority: 10 },
  { keyword: "INTEREST CREDIT", category: "INTEREST", priority: 10 },
  { keyword: "SAVINGS INTEREST", category: "INTEREST", priority: 10 },
  { keyword: "ANRF", category: "GRANT", priority: 10 },
  { keyword: "DST", category: "GRANT", priority: 10 },
  { keyword: "BANK CHARGES", category: "BANK_CHARGE", priority: 5 },
  { keyword: "SMS", category: "BANK_CHARGE", priority: 5 },
  { keyword: "TDS", category: "TAX", priority: 5 },
  { keyword: "REFUND", category: "REFUND", priority: 5 },
  { keyword: "REVERSAL", category: "REFUND", priority: 5 },
];

async function main() {
  for (const rule of rules) {
    await prisma.categorizationRule.upsert({
      where: { keyword: rule.keyword },
      update: { category: rule.category, priority: rule.priority, isActive: true },
      create: rule,
    });
    console.log(`Upserted rule: ${rule.keyword} -> ${rule.category}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });