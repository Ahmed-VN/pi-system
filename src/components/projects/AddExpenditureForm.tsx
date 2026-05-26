"use client";

// src/components/projects/AddExpenditureForm.tsx

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface BudgetHead {
  id: string;
  name: string;
  allocatedAmount: number; // already converted to Number by [id]/page.tsx
  category: string;
}

interface AddExpenditureFormProps {
  projectId: string;
  budgetHeads: BudgetHead[];
  /** Called after an expenditure is successfully recorded */
  onSuccess: () => void;
}

interface FormState {
  budgetHeadId: string;
  amount: string;
  description: string;
  date: string;
  invoiceNumber: string;
  vendor: string;
}

const EMPTY_FORM: FormState = {
  budgetHeadId: "",
  amount: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  invoiceNumber: "",
  vendor: "",
};

export default function AddExpenditureForm({
  projectId,
  budgetHeads,
  onSuccess,
}: AddExpenditureFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  // The budget head the user has selected (for showing remaining balance)
  const selectedHead = budgetHeads.find((bh) => bh.id === form.budgetHeadId);

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.budgetHeadId) next.budgetHeadId = "Select a budget head";
    if (!form.amount.trim()) next.amount = "Amount is required";
    else if (isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      next.amount = "Enter a valid positive amount";
    if (!form.description.trim())
      next.description = "Description is required";
    if (!form.date) next.date = "Date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          budgetHeadId: form.budgetHeadId,
          amount: Number(form.amount),
          description: form.description.trim(),
          date: form.date,
          invoiceNumber: form.invoiceNumber.trim() || null,
          vendor: form.vendor.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to record expenditure");
        return;
      }

      toast.success(
        `₹${Number(form.amount).toLocaleString("en-IN")} recorded under ${
          selectedHead?.name ?? "budget head"
        }`
      );
      setForm(EMPTY_FORM);
      setErrors({});
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <span aria-hidden="true">＋</span>
          Record expenditure
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record expenditure</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Budget head */}
          <div className="grid gap-1.5">
            <Label htmlFor="exp-head">
              Budget head <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.budgetHeadId}
              onValueChange={(val) => {
                setForm((f) => ({ ...f, budgetHeadId: val }));
                setErrors((err) => ({ ...err, budgetHeadId: undefined }));
              }}
            >
              <SelectTrigger
                id="exp-head"
                aria-invalid={!!errors.budgetHeadId}
              >
                <SelectValue placeholder="Select budget head…" />
              </SelectTrigger>
              <SelectContent>
                {budgetHeads.map((bh) => (
                  <SelectItem key={bh.id} value={bh.id}>
                    <span>{bh.name}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      — ₹{bh.allocatedAmount.toLocaleString("en-IN")} allocated
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.budgetHeadId && (
              <p className="text-xs text-destructive">{errors.budgetHeadId}</p>
            )}
            {/* Show selected head category as a hint */}
            {selectedHead && (
              <p className="text-xs text-muted-foreground">
                Category:{" "}
                <span className="font-medium">
                  {selectedHead.category === "NON_RECURRING"
                    ? "Non-recurring"
                    : "Recurring"}
                </span>{" "}
                · Allocated: ₹
                {selectedHead.allocatedAmount.toLocaleString("en-IN")}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="grid gap-1.5">
            <Label htmlFor="exp-amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
                ₹
              </span>
              <Input
                id="exp-amount"
                type="number"
                min={0.01}
                step={0.01}
                placeholder="25000"
                className="pl-7"
                value={form.amount}
                onChange={(e) => {
                  setForm((f) => ({ ...f, amount: e.target.value }));
                  setErrors((err) => ({ ...err, amount: undefined }));
                }}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "exp-amount-err" : undefined}
              />
            </div>
            {errors.amount && (
              <p id="exp-amount-err" className="text-xs text-destructive">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="exp-desc">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="exp-desc"
              rows={2}
              placeholder="Brief description of what this expenditure is for…"
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setForm((f) => ({ ...f, description: e.target.value }));
                setErrors((err) => ({ ...err, description: undefined }));
              }}
              aria-invalid={!!errors.description}
              aria-describedby={
                errors.description ? "exp-desc-err" : undefined
              }
            />
            {errors.description && (
              <p id="exp-desc-err" className="text-xs text-destructive">
                {errors.description}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="grid gap-1.5">
            <Label htmlFor="exp-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="exp-date"
              type="date"
              value={form.date}
              onChange={(e) => {
                setForm((f) => ({ ...f, date: e.target.value }));
                setErrors((err) => ({ ...err, date: undefined }));
              }}
              aria-invalid={!!errors.date}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="exp-invoice">Invoice no. — optional</Label>
              <Input
                id="exp-invoice"
                placeholder="INV-2024-001"
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exp-vendor">Vendor — optional</Label>
              <Input
                id="exp-vendor"
                placeholder="Vendor name"
                value={form.vendor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vendor: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving…" : "Record expenditure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
