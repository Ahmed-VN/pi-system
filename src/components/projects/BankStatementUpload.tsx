"use client";

// src/components/projects/BankStatementUpload.tsx

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  projectId: string;
  onUploadSuccess: (statementId: string) => void;
  trigger?: React.ReactNode;
}

interface UploadResult {
  success: boolean;
  statementId: string;
  parsingStatus: "PENDING" | "PARSED" | "FAILED" | "NEEDS_REVIEW";
  transactionCount: number;
  reconciliation: {
    balanced: boolean;
    actualDebitCount: number;
    actualDebitTotal: number;
    actualCreditCount: number;
    actualCreditTotal: number;
    expectedDebitCount: number | null;
    expectedDebitTotal: number | null;
    expectedCreditCount: number | null;
    expectedCreditTotal: number | null;
  };
}

export default function BankStatementUpload({ projectId, onUploadSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState<"AUTO" | "CANARA" | "SBI">("AUTO");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setFile(null);
      setResult(null);
      setBank("AUTO");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF statement");
      return;
    }
    setFile(f);
    setResult(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      if (bank !== "AUTO") fd.append("bank", bank);

      const res = await fetch("/api/finance/bank-statements", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

     if (!res.ok) {
  toast.error(data.detail ?? data.error ?? "Upload failed");
  return;
}

      setResult(data as UploadResult);
      if (data.parsingStatus === "PARSED") {
        toast.success(`${data.transactionCount} transactions parsed successfully`);
      } else {
        toast.warning(`Parsed with ${data.reconciliation.balanced ? "" : "reconciliation issues — "}rows flagged for review`);
      }
      onUploadSuccess(data.statementId);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            Upload Bank Statement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Bank Statement</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Bank</label>
            <Select value={bank} onValueChange={(v) => setBank(v as typeof bank)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto-detect</SelectItem>
                <SelectItem value="CANARA">Canara Bank</SelectItem>
                <SelectItem value="SBI">State Bank of India</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-sm font-medium">
              {file ? file.name : "Click to choose a PDF statement"}
            </p>
            {!file && <p className="text-xs text-muted-foreground mt-1">Text-based PDF only, not scanned</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {result && (
            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <p>
                <span className="font-medium">{result.transactionCount}</span> transactions parsed —{" "}
                <span className={result.parsingStatus === "PARSED" ? "text-green-600" : "text-amber-600"}>
                  {result.parsingStatus === "PARSED" ? "clean" : "needs review"}
                </span>
              </p>
              {result.reconciliation.expectedDebitCount !== null && (
                <p className="text-xs text-muted-foreground">
                  Reconciliation: {result.reconciliation.actualDebitCount}/{result.reconciliation.expectedDebitCount} debits,{" "}
                  {result.reconciliation.actualCreditCount}/{result.reconciliation.expectedCreditCount} credits matched
                  {result.reconciliation.balanced ? " — balanced" : " — mismatch, check review screen"}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" disabled={uploading}>
              {result ? "Close" : "Cancel"}
            </Button>
          </DialogClose>
          {!result && (
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload & Parse"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}