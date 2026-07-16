"use client";

// src/components/projects/CategoryReviewTable.tsx
//
// IMPORTANT: when rendering this component, pass key={statementId} alongside the
// statementId prop, e.g. <CategoryReviewTable statementId={id} key={id} />. This makes
// React remount the component (not just re-render) whenever the user switches to a
// different statement, so the initial `loading = true` state naturally re-applies —
// without needing a synchronous setState(true) inside the effect, which the
// react-hooks/set-state-in-effect lint rule flags.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Category =
  | "INTEREST"
  | "GRANT"
  | "BANK_CHARGE"
  | "TAX"
  | "REFUND"
  | "EXPENDITURE"
  | "UNCATEGORIZED";

const CATEGORY_LABELS: Record<Category, string> = {
  INTEREST: "Interest",
  GRANT: "Grant",
  BANK_CHARGE: "Bank Charge",
  TAX: "Tax",
  REFUND: "Refund",
  EXPENDITURE: "Expenditure",
  UNCATEGORIZED: "Uncategorized",
};

const CATEGORY_COLORS: Record<Category, string> = {
  INTEREST: "bg-blue-100 text-blue-800",
  GRANT: "bg-green-100 text-green-800",
  BANK_CHARGE: "bg-orange-100 text-orange-800",
  TAX: "bg-red-100 text-red-800",
  REFUND: "bg-purple-100 text-purple-800",
  EXPENDITURE: "bg-slate-100 text-slate-800",
  UNCATEGORIZED: "bg-gray-100 text-gray-600",
};

interface Transaction {
  id: string;
  transactionDate: string;
  narration: string;
  referenceNumber: string | null;
  debit: number | null;
  credit: number | null;
  balance: number;
  category: Category;
  matchConfidence: "EXACT" | "LIKELY" | "UNCERTAIN" | "UNMATCHED" | null;
  matchedExpenditure: { id: string; description: string; amount: number; expenditureDate: string } | null;
  parseConflict: string | null;
}

const MATCH_COLORS: Record<string, string> = {
  EXACT: "bg-green-100 text-green-800",
  LIKELY: "bg-blue-100 text-blue-800",
  UNCERTAIN: "bg-amber-100 text-amber-800",
  UNMATCHED: "bg-gray-100 text-gray-500",
};

interface StatementDetail {
  id: string;
  bankName: string;
  accountNumber: string;
  parsingStatus: string;
  parsingErrors: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: Transaction[];
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

// Plain module-level function — deliberately NOT defined inside the component, so
// there's no manual-memoization question for the React Compiler to trip over. It
// takes statementId as a parameter rather than closing over anything.
async function loadStatement(statementId: string): Promise<StatementDetail> {
  const res = await fetch(`/api/finance/bank-statements/${statementId}`);
  if (!res.ok) throw new Error("Failed to load statement");
  return res.json();
}

export default function CategoryReviewTable({ statementId }: { statementId: string }) {
  const [data, setData] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [matching, setMatching] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStatement(statementId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => toast.error("Failed to load statement"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statementId]);

  async function handleMarkReviewed() {
    setMarkingReviewed(true);
    try {
      const res = await fetch(`/api/finance/bank-statements/${statementId}/mark-reviewed`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to mark as reviewed");
        return;
      }
      toast.success("Statement marked as reviewed — UC generation is now unblocked for this statement");
      const refreshed = await loadStatement(statementId);
      setData(refreshed);
    } catch {
      toast.error("Network error");
    } finally {
      setMarkingReviewed(false);
    }
  }

  async function handleRunAllocation() {
    setAllocating(true);
    try {
      const res = await fetch(`/api/finance/bank-statements/${statementId}/allocate-interest`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Interest allocation failed");
        return;
      }
      if (result.allocations.length === 0) {
        toast.info(result.message ?? "No interest transactions found in this statement");
      } else {
        toast.success(
          `Allocated ${result.allocations.length} interest transaction(s)` +
            (result.warningsCount > 0 ? ` — ${result.warningsCount} with data-quality warnings, check Audit Log` : "")
        );
      }
    } catch {
      toast.error("Network error while allocating interest");
    } finally {
      setAllocating(false);
    }
  }

  async function handleRunMatching() {
    setMatching(true);
    try {
      const res = await fetch(`/api/finance/bank-statements/${statementId}/match`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Matching failed");
        return;
      }
      toast.success(
        `Matched: ${result.summary.exact} exact, ${result.summary.likely} likely, ${result.summary.uncertain} uncertain, ${result.summary.unmatched} unmatched`
      );
      const refreshed = await loadStatement(statementId);
      setData(refreshed);
    } catch {
      toast.error("Network error while matching");
    } finally {
      setMatching(false);
    }
  }

  async function handleCategoryChange(transactionId: string, newCategory: Category) {
    if (!data) return;

    setSavingIds((prev) => new Set(prev).add(transactionId));
    // optimistic update
    setData({
      ...data,
      transactions: data.transactions.map((t) =>
        t.id === transactionId ? { ...t, category: newCategory } : t
      ),
    });

    try {
      const res = await fetch(`/api/finance/bank-statements/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to update category");
      }
    } catch {
      toast.error("Network error — change may not have saved");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading statement…</p>;
  }

  if (!data) {
    return <p className="text-sm text-destructive py-8 text-center">Could not load statement.</p>;
  }

  const conflictCount = data.transactions.filter((t) => t.parseConflict).length;
  const uncategorizedCount = data.transactions.filter((t) => t.category === "UNCATEGORIZED").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4 text-sm">
        <div>
          <span className="font-medium">{data.bankName}</span> — {data.accountNumber} —{" "}
          {data.transactions.length} transactions
        </div>
        <div className="flex items-center gap-3">
          {conflictCount > 0 && (
            <Badge className="bg-red-100 text-red-800">{conflictCount} flagged for review</Badge>
          )}
          {uncategorizedCount > 0 && (
            <Badge className="bg-gray-100 text-gray-600">{uncategorizedCount} uncategorized</Badge>
          )}
          <span className="text-muted-foreground">
            Opening {fmt(data.openingBalance)} → Closing {fmt(data.closingBalance)}
          </span>
          <button
            onClick={handleRunMatching}
            disabled={matching}
            className="text-xs font-medium px-3 py-1.5 rounded-md border hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            {matching ? "Matching…" : "Run Expenditure Matching"}
          </button>
          <button
            onClick={handleRunAllocation}
            disabled={allocating}
            className="text-xs font-medium px-3 py-1.5 rounded-md border hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            {allocating ? "Allocating…" : "Run Interest Allocation"}
          </button>
          {data.parsingStatus === "NEEDS_REVIEW" && (
            <button
              onClick={handleMarkReviewed}
              disabled={markingReviewed}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {markingReviewed ? "Marking…" : "Mark as Reviewed"}
            </button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-2 font-medium">Date</th>
              <th className="text-left p-2 font-medium">Narration</th>
              <th className="text-right p-2 font-medium">Debit</th>
              <th className="text-right p-2 font-medium">Credit</th>
              <th className="text-right p-2 font-medium">Balance</th>
              <th className="text-left p-2 font-medium">Category</th>
              <th className="text-left p-2 font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr
                key={t.id}
                className={`border-b last:border-b-0 ${t.parseConflict ? "bg-red-50" : ""}`}
              >
                <td className="p-2 whitespace-nowrap align-top">
                  {new Date(t.transactionDate).toLocaleDateString("en-GB")}
                </td>
                <td className="p-2 align-top max-w-md">
                  <p className="line-clamp-2" title={t.narration}>
                    {t.narration}
                  </p>
                  {t.parseConflict && (
                    <p className="text-xs text-red-700 mt-1">⚠ {t.parseConflict}</p>
                  )}
                </td>
                <td className="p-2 text-right align-top whitespace-nowrap">{fmt(t.debit)}</td>
                <td className="p-2 text-right align-top whitespace-nowrap">{fmt(t.credit)}</td>
                <td className="p-2 text-right align-top whitespace-nowrap">{fmt(t.balance)}</td>
                <td className="p-2 align-top">
                  <Select
                    value={t.category}
                    onValueChange={(v) => handleCategoryChange(t.id, v as Category)}
                    disabled={savingIds.has(t.id)}
                  >
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue>
                        <Badge className={CATEGORY_COLORS[t.category]}>
                          {CATEGORY_LABELS[t.category]}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-2 align-top">
                  {t.matchConfidence && t.matchConfidence !== "UNMATCHED" ? (
                    <div>
                      <Badge className={MATCH_COLORS[t.matchConfidence]}>{t.matchConfidence}</Badge>
                      {t.matchedExpenditure && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[160px] line-clamp-2">
                          {t.matchedExpenditure.description}
                        </p>
                      )}
                    </div>
                  ) : t.matchConfidence === "UNMATCHED" ? (
                    <Badge className={MATCH_COLORS.UNMATCHED}>Unmatched</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}