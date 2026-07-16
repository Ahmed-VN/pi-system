"use client";

// src/components/projects/BankStatementsSection.tsx
//
// Self-contained: fetches the statement list, handles selection, and renders the
// review table with the correct key={} pattern internally. Drop this into a project
// page with just <BankStatementsSection projectId={project.id} /> — no external state
// wiring needed.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import BankStatementUpload from "./BankStatementUpload";
import CategoryReviewTable from "./CategoryReviewTable";

interface StatementSummary {
  id: string;
  bankName: string;
  accountNumber: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  parsingStatus: "PENDING" | "PARSED" | "FAILED" | "NEEDS_REVIEW";
  transactionCount: number;
}

const STATUS_COLORS: Record<StatementSummary["parsingStatus"], string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PARSED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
};

export default function BankStatementsSection({ projectId }: { projectId: string }) {
  const [statements, setStatements] = useState<StatementSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const loadStatements = useCallback(() => {
    return fetch(`/api/finance/bank-statements?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        setStatements(d.statements ?? []);
        return d.statements as StatementSummary[];
      })
      .catch(() => {
        toast.error("Failed to load bank statements");
        return [];
      });
  }, [projectId]);

  useEffect(() => {
    loadStatements().finally(() => setLoadingList(false));
  }, [loadStatements]);

  function handleUploadSuccess(newStatementId: string) {
    loadStatements().then(() => setSelectedId(newStatementId));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Bank Statements</h3>
        <BankStatementUpload projectId={projectId} onUploadSuccess={handleUploadSuccess} />
      </div>

      {loadingList ? (
        <p className="text-sm text-muted-foreground">Loading statements…</p>
      ) : statements.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">
          No bank statements uploaded yet.
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {statements.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-muted/40 transition-colors ${
                selectedId === s.id ? "bg-muted/60" : ""
              }`}
            >
              <span>
                <span className="font-medium">{s.bankName}</span> — {s.accountNumber} —{" "}
                {new Date(s.statementPeriodStart).toLocaleDateString("en-GB")} to{" "}
                {new Date(s.statementPeriodEnd).toLocaleDateString("en-GB")} —{" "}
                {s.transactionCount} transactions
              </span>
              <Badge className={STATUS_COLORS[s.parsingStatus]}>{s.parsingStatus}</Badge>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        // key={selectedId} here is what makes the table cleanly reset (loading state,
        // fetched data) every time a different statement row is clicked — this is the
        // one place that pattern needs to live, and it already does.
        <CategoryReviewTable statementId={selectedId} key={selectedId} />
      )}
    </div>
  );
}