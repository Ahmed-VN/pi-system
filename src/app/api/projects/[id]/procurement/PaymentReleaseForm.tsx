"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Banknote, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PaymentReleaseFormProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  requestDescription: string;
  estimatedAmount: number;
  checklistComplete: boolean;
  goodsReceived: boolean;
}

const PURCHASE_ORIGIN_OPTIONS = [
  { value: "RC_OFFICE", label: "RC Office (Research Council)" },
  { value: "INSTITUTE", label: "Institute / NITC Finance" },
  { value: "DIRECT_PI", label: "Direct — PI Account" },
];

const PAYMENT_MODE_OPTIONS = [
  { value: "NEFT", label: "NEFT / RTGS" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "DEMAND_DRAFT", label: "Demand Draft" },
  { value: "ONLINE", label: "Online Portal (GeM/PFMS)" },
];

export default function PaymentReleaseForm({
  open,
  onClose,
  requestId,
  requestDescription,
  estimatedAmount,
  checklistComplete,
  goodsReceived,
}: PaymentReleaseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    invoiceNumber: "",
    invoiceAmount: estimatedAmount?.toString() || "",
    invoiceDate: "",
    purchaseOrigin: "",
    paymentMode: "NEFT",
    vendorBankAccount: "",
    vendorIfsc: "",
    remarks: "",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const invoiceVsEstimate = form.invoiceAmount
    ? Math.abs(Number(form.invoiceAmount) - estimatedAmount) / estimatedAmount
    : 0;
  const amountMismatch = invoiceVsEstimate > 0.1;

  async function handleSubmit() {
    setError("");
    if (!form.invoiceNumber || !form.invoiceAmount || !form.invoiceDate || !form.purchaseOrigin) {
      setError("Please fill all required fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement/requests/${requestId}/payment-release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: form.invoiceNumber,
          invoiceAmount: parseFloat(form.invoiceAmount),
          invoiceDate: form.invoiceDate,
          purchaseOrigin: form.purchaseOrigin,
          paymentMode: form.paymentMode,
          vendorBankAccount: form.vendorBankAccount || undefined,
          vendorIfsc: form.vendorIfsc || undefined,
          remarks: form.remarks || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release payment");

      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5 text-blue-600" />
            Release Payment
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1 truncate">{requestDescription}</p>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-green-700 font-medium">Payment release submitted.</p>
            <p className="text-sm text-gray-500">Finance team has been notified.</p>
          </div>
        ) : (
          <div className="space-y-5 py-2">

            {/* Status indicators — informational only, no longer block submission */}
            <div className="space-y-2">
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                checklistComplete
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
              }`}>
                {checklistComplete
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                Document checklist — {checklistComplete ? "complete" : "incomplete"}
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                goodsReceived
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
              }`}>
                {goodsReceived
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                Goods receipt — {goodsReceived ? "recorded" : "not recorded"}
              </div>
            </div>

            {/* Invoice details — always enabled */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Invoice Number <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. INV-2026-001" value={form.invoiceNumber} onChange={set("invoiceNumber")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Invoice Date <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.invoiceDate} onChange={set("invoiceDate")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Invoice Amount (₹) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={form.invoiceAmount}
                  onChange={set("invoiceAmount")}
                  placeholder={estimatedAmount?.toString()}
                />
                {amountMismatch && (
                  <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Invoice amount differs from estimate by more than 10% — ensure this is correct.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Purchase Origin <span className="text-red-500">*</span></Label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.purchaseOrigin}
                  onChange={set("purchaseOrigin")}
                >
                  <option value="">Select origin</option>
                  {PURCHASE_ORIGIN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.paymentMode}
                  onChange={set("paymentMode")}
                >
                  {PAYMENT_MODE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {form.paymentMode === "NEFT" && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-1.5">
                    <Label>Vendor Bank Account</Label>
                    <Input placeholder="Account number" value={form.vendorBankAccount} onChange={set("vendorBankAccount")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>IFSC Code</Label>
                    <Input placeholder="e.g. SBIN0001234" value={form.vendorIfsc} onChange={set("vendorIfsc")} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes for the finance team…"
                  value={form.remarks}
                  onChange={set("remarks")}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Release Payment
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}