"use client";

// src/components/projects/FinanceToolbar.tsx

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// ── Icons (inline SVG to avoid extra deps) ───────────────────────────────────
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ExcelIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
);

const PdfIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const WordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13l1.5 5L11 14l1.5 4L14 13" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckCircle = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const AlertCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImportResult {
  success: boolean;
  imported: number;
  newBudgetHeads: string[];
  errors: { row: number; field: string; message: string }[];
}

interface Props {
  projectId: string;
  projectStartDate?: string;
  projectEndDate?: string;
  onImportSuccess: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Generates ANRF-style financial years (Apr–Mar) spanning the project duration.
function generateFinancialYears(startDate?: string, endDate?: string): string[] {
  if (!startDate || !endDate) {
    // Fallback: current FY only, so the dropdown is never empty
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return [`${fyStart}-${fyStart + 1}`];
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  let fyStartYear = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1;
  const fyEndYear = end.getMonth() >= 3 ? end.getFullYear() : end.getFullYear() - 1;
  const years: string[] = [];
  while (fyStartYear <= fyEndYear) {
    years.push(`${fyStartYear}-${fyStartYear + 1}`);
    fyStartYear++;
  }
  return years;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FinanceToolbar({ projectId, projectStartDate, projectEndDate, onImportSuccess }: Props) {
  const financialYears = generateFinancialYears(projectStartDate, projectEndDate);

  // Export state
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingStatement, setExportingStatement] = useState(false);
  const [exportingUC, setExportingUC] = useState(false);
  const [generatingUCDocx, setGeneratingUCDocx] = useState(false);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grant release state
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);
  const [releaseForm, setReleaseForm] = useState({
    sanctionNo: "",
    sanctionDate: "",
    amount: "",
    recurringAmount: "", nonRecurringAmount: "",
    financialYear: financialYears[0] ?? "",
    remarks: "",
  });

  // UC generation state
  const [ucOpen, setUcOpen] = useState(false);
  const [ucForm, setUcForm] = useState({
    fy: financialYears[0] ?? "",
    fundType: "RECURRING" as "RECURRING" | "NON_RECURRING",
    ucStatus: "Provisional",
    interestEarned: "0",
    interestDeposited: "0",
    cfoName: "",
    headOrgName: "",
    certPlace: "",
  });

  // SOE generation state
  const [soeOpen, setSoeOpen] = useState(false);
  const [soeFy, setSoeFy] = useState(financialYears[0] ?? "");
  const [generatingSOE, setGeneratingSOE] = useState(false);

  // ── Export helpers ──────────────────────────────────────────────────────────
  async function triggerDownload(url: string, setLoading: (v: boolean) => void, label: string) {
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? `Failed to export ${label}`);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `${label}_${projectId}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`${label} downloaded`);
    } catch {
      toast.error(`Network error while exporting ${label}`);
    } finally {
      setLoading(false);
    }
  }

  const handleExportExcel = () =>
    triggerDownload(
      `/api/finance/export/excel?projectId=${projectId}`,
      setExportingExcel,
      "Finance Excel"
    );

  const handleExportStatement = () =>
    triggerDownload(
      `/api/finance/export/pdf?projectId=${projectId}&type=statement`,
      setExportingStatement,
      "Expenditure Statement"
    );

  const handleExportUC = () =>
    triggerDownload(
      `/api/finance/export/pdf?projectId=${projectId}&type=uc`,
      setExportingUC,
      "Utilization Certificate"
    );

  // ── Template download ────────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    await triggerDownload(
      `/api/finance/template?projectId=${projectId}`,
      () => {},
      "Import Template"
    );
  }

  // ── Import ───────────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx")) {
      toast.error("Please upload an .xlsx file");
      return;
    }
    setSelectedFile(f);
    setImportResult(null);
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch(`/api/finance/import?projectId=${projectId}`, {
        method: "POST",
        body: fd,
      });
      const data: ImportResult & { error?: string } = await res.json();

      if (!res.ok && res.status !== 422) {
        toast.error(data.error ?? "Import failed");
        return;
      }

      setImportResult(data);

      if (data.imported > 0) {
        toast.success(`${data.imported} expenditure${data.imported > 1 ? "s" : ""} imported`);
        onImportSuccess();
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setImporting(false);
    }
  }

  function handleImportOpenChange(open: boolean) {
    setImportOpen(open);
    if (!open) {
      setSelectedFile(null);
      setImportResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Grant release ─────────────────────────────────────────────────────────────
  function handleReleaseOpenChange(open: boolean) {
    setReleaseOpen(open);
    if (!open) {
      setReleaseForm({
        sanctionNo: "",
        sanctionDate: "",
        amount: "",
        recurringAmount: "",
        nonRecurringAmount: "",
        financialYear: financialYears[0] ?? "",
        remarks: "",
      });
    }
  }

  async function handleLogRelease() {
    if (!releaseForm.sanctionNo || !releaseForm.sanctionDate || !releaseForm.amount) {
      toast.error("Sanction no., date, and amount are required");
      return;
    }
    setReleaseSubmitting(true);
    try {
      const res = await fetch("/api/finance/grant-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sanctionNo: releaseForm.sanctionNo,
          sanctionDate: releaseForm.sanctionDate,
          amount: Number(releaseForm.amount),
          recurringAmount: Number(releaseForm.recurringAmount) || undefined,
          nonRecurringAmount: Number(releaseForm.nonRecurringAmount) || undefined,
          financialYear: releaseForm.financialYear,
          remarks: releaseForm.remarks || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to log grant release");
        return;
      }
      toast.success("Grant release logged");
      handleReleaseOpenChange(false);
      onImportSuccess(); // reuse the same "refresh financials" callback
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setReleaseSubmitting(false);
    }
  }

  // ── UC docx generation ───────────────────────────────────────────────────────
  async function handleGenerateUCDocx() {
    if (!ucForm.cfoName || !ucForm.headOrgName || !ucForm.certPlace) {
      toast.error("CFO name, Head of Organisation, and Place are required");
      return;
    }
    setGeneratingUCDocx(true);
    try {
      const params = new URLSearchParams({
        projectId,
        fy: ucForm.fy,
        fundType: ucForm.fundType,
        ucStatus: ucForm.ucStatus,
        interestEarned: ucForm.interestEarned || "0",
        interestDeposited: ucForm.interestDeposited || "0",
        cfoName: ucForm.cfoName,
        headOrgName: ucForm.headOrgName,
        certPlace: ucForm.certPlace,
      });
      const res = await fetch(`/api/finance/export/uc-docx?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.blockers?.length) {
          toast.error(`Cannot generate: ${err.blockers[0]}`, {
            description: err.blockers.length > 1 ? `+${err.blockers.length - 1} more issue(s) — check console` : undefined,
          });
          console.error("UC generation blockers:", err.blockers);
        } else {
          toast.error(err.error ?? "Failed to generate UC");
        }
        return;
      }
      await triggerDownload(
        `/api/finance/export/uc-docx?${params.toString()}`,
        setGeneratingUCDocx,
        "Utilization Certificate (Word)"
      );
      setUcOpen(false);
    } finally {
      setGeneratingUCDocx(false);
    }
  }

  // ── SOE docx generation ──────────────────────────────────────────────────────
  async function handleGenerateSOE() {
    setGeneratingSOE(true);
    try {
      const params = new URLSearchParams({ projectId, fy: soeFy });
      await triggerDownload(
        `/api/finance/export/soe-docx?${params.toString()}`,
        setGeneratingSOE,
        "Statement of Expenditure"
      );
      setSoeOpen(false);
    } finally {
      setGeneratingSOE(false);
    }
  }

  const anyExporting = exportingExcel || exportingStatement || exportingUC || generatingUCDocx;

  return (
    <div className="flex items-center gap-2">
      {/* ── LOG GRANT RELEASE BUTTON ── */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setReleaseOpen(true)}
      >
        <PlusIcon />
        Log Grant Release
      </Button>

      {/* ── IMPORT BUTTON ── */}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setImportOpen(true)}
      >
        <UploadIcon />
        Import Excel
      </Button>

      {/* ── EXPORT DROPDOWN ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={anyExporting}
          >
            <DownloadIcon />
            {anyExporting ? "Exporting…" : "Export"}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Export As</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={handleExportExcel}
            disabled={exportingExcel}
          >
            <ExcelIcon />
            <span>Excel Workbook</span>
            <span className="ml-auto text-xs text-muted-foreground">.xlsx</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">PDF</DropdownMenuLabel>

          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={handleExportStatement}
            disabled={exportingStatement}
          >
            <PdfIcon />
            <span>Expenditure Statement</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={handleExportUC}
            disabled={exportingUC}
          >
            <PdfIcon />
            <span>Utilization Certificate</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Word (Auto-fill)</DropdownMenuLabel>

          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => setUcOpen(true)}
            disabled={generatingUCDocx}
          >
            <WordIcon />
            <span>Utilization Certificate (GFR 12-A)</span>
            <span className="ml-auto text-xs text-muted-foreground">.docx</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => setSoeOpen(true)}
            disabled={generatingSOE}
          >
            <WordIcon />
            <span>Statement of Expenditure (SOE)</span>
            <span className="ml-auto text-xs text-muted-foreground">.docx</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── GRANT RELEASE DIALOG ── */}
      <Dialog open={releaseOpen} onOpenChange={handleReleaseOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Grant Release</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sanctionNo">Sanction No.</Label>
              <Input
                id="sanctionNo"
                placeholder="e.g. ANRF/ARG/2025/001234"
                value={releaseForm.sanctionNo}
                onChange={(e) => setReleaseForm((f) => ({ ...f, sanctionNo: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="sanctionDate">Sanction Date</Label>
                <Input
                  id="sanctionDate"
                  type="date"
                  value={releaseForm.sanctionDate}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, sanctionDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={releaseForm.amount}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="recurringAmount">Recurring Amount (₹)</Label>
                <Input id="recurringAmount" type="number" value={releaseForm.recurringAmount}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, recurringAmount: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nonRecurringAmount">Non-Recurring Amount (₹)</Label>
                <Input id="nonRecurringAmount" type="number" value={releaseForm.nonRecurringAmount}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, nonRecurringAmount: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="financialYear">Financial Year</Label>
              <Select
                value={releaseForm.financialYear}
                onValueChange={(v) => setReleaseForm((f) => ({ ...f, financialYear: v }))}
              >
                <SelectTrigger id="financialYear">
                  <SelectValue placeholder="Select financial year" />
                </SelectTrigger>
                <SelectContent>
                  {financialYears.map((fy) => (
                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Input
                id="remarks"
                placeholder="e.g. 2nd tranche release"
                value={releaseForm.remarks}
                onChange={(e) => setReleaseForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={releaseSubmitting}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleLogRelease} disabled={releaseSubmitting}>
              {releaseSubmitting ? "Saving…" : "Log Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── UC GENERATION DIALOG ── */}
      <Dialog open={ucOpen} onOpenChange={setUcOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Utilization Certificate</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ucFy">Financial Year</Label>
                <Select
                  value={ucForm.fy}
                  onValueChange={(v) => setUcForm((f) => ({ ...f, fy: v }))}
                >
                  <SelectTrigger id="ucFy">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {financialYears.map((fy) => (
                      <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ucStatus">UC Status</Label>
                <Select
                  value={ucForm.ucStatus}
                  onValueChange={(v) => setUcForm((f) => ({ ...f, ucStatus: v }))}
                >
                  <SelectTrigger id="ucStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Provisional">Provisional</SelectItem>
                    <SelectItem value="Audited">Audited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="fundType">Fund Type</Label>
              <Select
                value={ucForm.fundType}
                onValueChange={(v) => setUcForm((f) => ({ ...f, fundType: v as "RECURRING" | "NON_RECURRING" }))}
              >
                <SelectTrigger id="fundType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECURRING">Recurring</SelectItem>
                  <SelectItem value="NON_RECURRING">Non-Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="interestEarned">Interest Earned (₹)</Label>
                <Input
                  id="interestEarned"
                  type="number"
                  value={ucForm.interestEarned}
                  onChange={(e) => setUcForm((f) => ({ ...f, interestEarned: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="interestDeposited">Interest Deposited (₹)</Label>
                <Input
                  id="interestDeposited"
                  type="number"
                  value={ucForm.interestDeposited}
                  onChange={(e) => setUcForm((f) => ({ ...f, interestDeposited: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cfoName">Chief Finance Officer Name</Label>
              <Input
                id="cfoName"
                placeholder="Name of CFO / Head of Finance"
                value={ucForm.cfoName}
                onChange={(e) => setUcForm((f) => ({ ...f, cfoName: e.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="headOrgName">Head of Organisation Name</Label>
              <Input
                id="headOrgName"
                placeholder="Name of Head of Organisation"
                value={ucForm.headOrgName}
                onChange={(e) => setUcForm((f) => ({ ...f, headOrgName: e.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="certPlace">Place</Label>
              <Input
                id="certPlace"
                placeholder="e.g. Calicut"
                value={ucForm.certPlace}
                onChange={(e) => setUcForm((f) => ({ ...f, certPlace: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={generatingUCDocx}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleGenerateUCDocx} disabled={generatingUCDocx}>
              {generatingUCDocx ? "Generating…" : "Generate & Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SOE GENERATION DIALOG ── */}
      <Dialog open={soeOpen} onOpenChange={setSoeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Statement of Expenditure</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="soeFy">Financial Year</Label>
            <Select value={soeFy} onValueChange={setSoeFy}>
              <SelectTrigger id="soeFy">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((fy) => (
                  <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={generatingSOE}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleGenerateSOE} disabled={generatingSOE || !soeFy}>
              {generatingSOE ? "Generating…" : "Generate & Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMPORT DIALOG ── */}
      <Dialog open={importOpen} onOpenChange={handleImportOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Expenditures</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Step 1 — template */}
            <div className="rounded-lg border border-dashed p-4 bg-muted/30">
              <p className="text-sm font-medium mb-1">Step 1 — Download the template</p>
              <p className="text-xs text-muted-foreground mb-3">
                The template is pre-filled with this project&apos; budget heads and includes a Category
                dropdown for any new heads you want to add.
              </p>
              <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={handleDownloadTemplate}>
                <DownloadIcon />
                Download Import Template (.xlsx)
              </Button>
            </div>

            {/* Step 2 — upload */}
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-1">Step 2 — Fill &amp; upload</p>
              <p className="text-xs text-muted-foreground mb-3">
                Fill in your expenditures, then upload the file below. New budget heads will be
                auto-created with ₹0 allocated amount.
              </p>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon />
                <p className="mt-2 text-sm font-medium">
                  {selectedFile ? selectedFile.name : "Click to choose .xlsx file"}
                </p>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
                {!selectedFile && (
                  <p className="text-xs text-muted-foreground mt-1">Only .xlsx files accepted</p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg border p-4 space-y-3">
                {importResult.imported > 0 && (
                  <div className="flex items-center gap-3">
                    <CheckCircle />
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        {importResult.imported} expenditure{importResult.imported > 1 ? "s" : ""} imported
                      </p>
                      {importResult.newBudgetHeads.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          New budget heads created:{" "}
                          <span className="font-medium">
                            {importResult.newBudgetHeads.join(", ")}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-2">
                      {importResult.errors.length} row{importResult.errors.length > 1 ? "s" : ""} skipped
                      due to errors:
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertCircle />
                          <span>
                            Row {err.row} — <span className="font-medium">{err.field}</span>:{" "}
                            {err.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.imported === 0 && importResult.errors.length === 0 && (
                  <p className="text-sm text-muted-foreground">No rows found to import.</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={importing}>
                {importResult?.imported ? "Close" : "Cancel"}
              </Button>
            </DialogClose>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importing}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}