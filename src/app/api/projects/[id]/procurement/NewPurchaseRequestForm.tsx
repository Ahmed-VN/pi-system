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
import { Loader2, ShoppingCart, Info } from "lucide-react";

interface Project {
  id: string;
  title: string;
}

interface BudgetHead {
  id: string;
  name: string;
  balance: number;
}

interface NewPurchaseRequestFormProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  budgetHeads: BudgetHead[];
  currentUserId: string;
}

// Must match the Prisma `SourcingType` enum exactly: GEM | NON_GEM | PROPRIETARY
const SOURCING_TYPES = [
  { value: "GEM", label: "GeM Portal" },
  { value: "NON_GEM", label: "Open Market / Tender (Non-GeM)" },
  { value: "PROPRIETARY", label: "Proprietary / Single Source" },
];

function tierLabel(amount: number, sourcing: string) {
  if (!amount || !sourcing) return null;
  if (amount < 5000) return { label: "Petty Cash", color: "bg-green-100 text-green-800" };
  if (amount <= 25000) return { label: "PI Approval", color: "bg-blue-100 text-blue-800" };
  if (amount <= 100000) return { label: "Local Committee", color: "bg-yellow-100 text-yellow-800" };
  return { label: "Institute Committee", color: "bg-red-100 text-red-800" };
}

export default function NewPurchaseRequestForm({
  open,
  onClose,
  projects,
  budgetHeads,
  currentUserId,
}: NewPurchaseRequestFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    projectId: "",
    budgetHeadId: "",
    itemDescription: "",   // UI label: "Item Description" -> sent to API as itemName
    specifications: "",    // UI label: "Technical Specifications" -> sent to API as itemDescription
    quantity: "1",
    estimatedAmount: "",   // sent to API as estimatedCost
    sourcingType: "",
    vendorName: "",
    vendorContact: "",     // no dedicated column yet -> sent to API as vendorAddress
    justification: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const tier = tierLabel(Number(form.estimatedAmount), form.sourcingType);

  const filteredBudgetHeads = form.projectId
    ? budgetHeads.filter((b) => (b as any).projectId === form.projectId)
    : budgetHeads;

  async function handleSubmit() {
    setError("");
    if (
      !form.projectId ||
      !form.budgetHeadId ||
      !form.itemDescription ||
      !form.estimatedAmount ||
      !form.sourcingType ||
      !form.justification.trim()
    ) {
      setError("Please fill all required fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/procurement/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.projectId,
          budgetHeadId: form.budgetHeadId,
          itemName: form.itemDescription,
          itemDescription: form.specifications || form.itemDescription,
          quantity: parseInt(form.quantity) || 1,
          estimatedCost: parseFloat(form.estimatedAmount),
          justification: form.justification,
          sourcingType: form.sourcingType,
          vendorName: form.vendorName || undefined,
          vendorAddress: form.vendorContact || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create request");
      router.refresh();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            New Purchase Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Project & Budget Head */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Project <span className="text-red-500">*</span></Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.projectId}
                onChange={set("projectId")}
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Budget Head <span className="text-red-500">*</span></Label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.budgetHeadId}
                onChange={set("budgetHeadId")}
                disabled={!form.projectId}
              >
                <option value="">Select budget head</option>
                {filteredBudgetHeads.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — ₹{b.balance.toLocaleString("en-IN")} available
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Details */}
          <div className="space-y-1.5">
            <Label>Item Description <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Dell Inspiron 15 Laptop"
              value={form.itemDescription}
              onChange={set("itemDescription")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Technical Specifications</Label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="RAM, storage, processor, make/model requirements…"
              value={form.specifications}
              onChange={set("specifications")}
            />
          </div>

          {/* Amount & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estimated Amount (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                placeholder="0"
                value={form.estimatedAmount}
                onChange={set("estimatedAmount")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={set("quantity")}
              />
            </div>
          </div>

          {/* Approval Tier Banner */}
          {tier && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Info className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-600">Approval route:</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tier.color}`}>
                {tier.label}
              </span>
            </div>
          )}

          {/* Sourcing Type */}
          <div className="space-y-1.5">
            <Label>Sourcing Method <span className="text-red-500">*</span></Label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.sourcingType}
              onChange={set("sourcingType")}
            >
              <option value="">Select sourcing method</option>
              {SOURCING_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Vendor (optional, for proprietary) */}
          {form.sourcingType === "PROPRIETARY" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="col-span-2 text-xs text-orange-700 font-medium">
                Proprietary purchases require additional justification and vendor details.
              </div>
              <div className="space-y-1.5">
                <Label>Vendor Name</Label>
                <Input placeholder="Company name" value={form.vendorName} onChange={set("vendorName")} />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor Contact</Label>
                <Input placeholder="Email or phone" value={form.vendorContact} onChange={set("vendorContact")} />
              </div>
            </div>
          )}

          {/* Justification */}
          <div className="space-y-1.5">
            <Label>Justification / Purpose <span className="text-red-500">*</span></Label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-18 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="How this item supports the research project…"
              value={form.justification}
              onChange={set("justification")}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}