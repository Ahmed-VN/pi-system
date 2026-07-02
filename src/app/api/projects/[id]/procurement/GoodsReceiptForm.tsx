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
import { Loader2, PackageCheck, AlertTriangle, Info } from "lucide-react";

interface GoodsReceiptFormProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  requestDescription: string;
  estimatedAmount: number;
}

const CONDITION_OPTIONS = [
  { value: "OK", label: "Good — item received in perfect condition" },
  { value: "DAMAGED", label: "Damaged — item received with visible damage" },
  { value: "PARTIAL", label: "Partial delivery — only part of order received" },
];

export default function GoodsReceiptForm({
  open,
  onClose,
  requestId,
  requestDescription,
  estimatedAmount,
}: GoodsReceiptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    deliveryDate: new Date().toISOString().split("T")[0],
    condition: "OK",
    receivedBy: "",
    deliveryNoteNumber: "",
    remarks: "",
    // Asset fields
    serialNumber: "",
    location: "",
    warrantyExpiry: "",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // Assets are registered for items above ₹1000
  const registersAsset = estimatedAmount >= 1000;

  async function handleSubmit() {
    setError("");
    if (!form.deliveryDate || !form.condition) {
      setError("Delivery date and condition are required.");
      return;
    }
    setLoading(true);
    try {
      const body: any = {
        deliveryDate: form.deliveryDate,
        condition: form.condition,
        receivedBy: form.receivedBy || undefined,
        deliveryNoteNumber: form.deliveryNoteNumber || undefined,
        remarks: form.remarks || undefined,
      };
      if (registersAsset) {
        body.serialNumber = form.serialNumber || undefined;
        body.location = form.location || undefined;
        body.warrantyExpiry = form.warrantyExpiry || undefined;
      }

      const res = await fetch(`/api/procurement/requests/${requestId}/goods-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record receipt");

      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
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
            <PackageCheck className="h-5 w-5 text-green-600" />
            Record Goods Receipt
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1 truncate">{requestDescription}</p>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <PackageCheck className="h-12 w-12 text-green-500" />
            <p className="text-green-700 font-medium">Goods receipt recorded.</p>
            {registersAsset && (
              <p className="text-sm text-gray-500">Asset entry created in the register.</p>
            )}
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Delivery info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Delivery Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.deliveryDate} onChange={set("deliveryDate")} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Note / Challan No.</Label>
                <Input placeholder="e.g. DN-20260620" value={form.deliveryNoteNumber} onChange={set("deliveryNoteNumber")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Condition <span className="text-red-500">*</span></Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.condition}
                onChange={set("condition")}
              >
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {form.condition !== "OK" && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <p className="text-sm text-orange-700">
                  Document the condition in remarks. Payment release may be held pending resolution.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Received By</Label>
              <Input placeholder="Name of person who received the item" value={form.receivedBy} onChange={set("receivedBy")} />
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any observations about delivery…"
                value={form.remarks}
                onChange={set("remarks")}
              />
            </div>

            {/* Asset registration section */}
            {registersAsset && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-medium text-blue-800">
                    Asset Registration — estimated ₹{estimatedAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-xs text-blue-600">
                  Items valued ≥ ₹1,000 are automatically added to the asset register. Provide details where available.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Serial / Model Number</Label>
                    <Input placeholder="e.g. SN123456" value={form.serialNumber} onChange={set("serialNumber")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location / Lab</Label>
                    <Input placeholder="e.g. Lab 301, ESB" value={form.location} onChange={set("location")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Warranty Expiry Date</Label>
                  <Input type="date" value={form.warrantyExpiry} onChange={set("warrantyExpiry")} />
                </div>
              </div>
            )}

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
            <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Receipt
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}