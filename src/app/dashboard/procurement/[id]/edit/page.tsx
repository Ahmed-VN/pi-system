"use client";

// src/app/dashboard/procurement/[id]/edit/page.tsx
// Pre-filled edit form for DRAFT or REJECTED procurement requests.

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Send } from "lucide-react";
import { toast } from "sonner";

interface BudgetHead {
  id: string;
  headName: string;
  category: string;
  allocatedAmount: number;
}

interface ProcurementRequest {
  id: string;
  projectId: string;
  budgetHeadId: string;
  itemName: string;
  itemDescription: string;
  quantity: number;
  estimatedCost: number;
  justification: string;
  sourcingType: string;
  vendorName: string | null;
  vendorAddress: string | null;
  vendorGst: string | null;
  quoteReference: string | null;
  status: string;
  submittedBy: { id: string };
  project: {
    id: string;
    title: string;
    sanctionNumber: string;
    budgetHeads: BudgetHead[];
  };
}

export default function EditProcurementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest]     = useState<ProcurementRequest | null>(null);

  const [form, setForm] = useState({
    budgetHeadId:    "",
    itemName:        "",
    itemDescription: "",
    quantity:        "1",
    estimatedCost:   "",
    justification:   "",
    sourcingType:    "NON_GEM",
    vendorName:      "",
    vendorAddress:   "",
    vendorGst:       "",
    quoteReference:  "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/procurement/${id}`);
        if (!res.ok) throw new Error();
        const data: ProcurementRequest = await res.json();

        // Only the submitter can edit
        if (data.submittedBy.id !== session?.user?.id) {
          toast.error("You don't have permission to edit this request.");
          router.push(`/dashboard/procurement/${id}`);
          return;
        }
        if (data.status !== "DRAFT" && data.status !== "REJECTED") {
          toast.error("Only DRAFT or REJECTED requests can be edited.");
          router.push(`/dashboard/procurement/${id}`);
          return;
        }

        setRequest(data);
        setForm({
          budgetHeadId:    data.budgetHeadId,
          itemName:        data.itemName,
          itemDescription: data.itemDescription,
          quantity:        String(data.quantity),
          estimatedCost:   String(data.estimatedCost),
          justification:   data.justification,
          sourcingType:    data.sourcingType,
          vendorName:      data.vendorName      ?? "",
          vendorAddress:   data.vendorAddress   ?? "",
          vendorGst:       data.vendorGst       ?? "",
          quoteReference:  data.quoteReference  ?? "",
        });
      } catch {
        toast.error("Failed to load request.");
        router.push("/dashboard/procurement");
      } finally {
        setLoading(false);
      }
    }
    if (session) load();
  }, [id, session, router]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(submitNow: boolean) {
    if (
      !form.budgetHeadId ||
      !form.itemName.trim() ||
      !form.itemDescription.trim() ||
      !form.quantity ||
      !form.estimatedCost ||
      !form.justification.trim()
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      // First PATCH to update fields
      const patchRes = await fetch(`/api/procurement/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json();
        throw new Error(err.error ?? "Save failed");
      }

      // Then submit if requested
      if (submitNow) {
        const submitRes = await fetch(`/api/procurement/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "submit" }),
        });
        if (!submitRes.ok) {
          const err = await submitRes.json();
          throw new Error(err.error ?? "Submit failed");
        }
        toast.success("Request updated and submitted to PI!");
      } else {
        toast.success("Draft saved.");
      }

      router.push(`/dashboard/procurement/${id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !request) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const budgetHeads = request.project.budgetHeads ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/procurement/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Procurement Request</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {request.project.title} — {request.project.sanctionNumber}
          </p>
        </div>
      </div>

      {request.status === "REJECTED" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This request was rejected. Update the details below and resubmit to the PI.
        </div>
      )}

      {/* Budget Head */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Head</CardTitle>
          <CardDescription>Change the budget head if needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Budget Head <span className="text-destructive">*</span></Label>
            <Select value={form.budgetHeadId} onValueChange={(v) => set("budgetHeadId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select budget head" />
              </SelectTrigger>
              <SelectContent>
                {budgetHeads.map((bh) => (
                  <SelectItem key={bh.id} value={bh.id}>
                    {bh.headName} ({bh.category.replace("_", "-")}) — ₹
                    {bh.allocatedAmount.toLocaleString("en-IN")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Item Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Item Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item Name <span className="text-destructive">*</span></Label>
            <Input
              value={form.itemName}
              onChange={(e) => set("itemName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Item Description / Specification <span className="text-destructive">*</span></Label>
            <Textarea
              rows={3}
              value={form.itemDescription}
              onChange={(e) => set("itemDescription", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Cost (₹) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min={0}
                value={form.estimatedCost}
                onChange={(e) => set("estimatedCost", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Justification / Purpose <span className="text-destructive">*</span></Label>
            <Textarea
              rows={4}
              value={form.justification}
              onChange={(e) => set("justification", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vendor / Sourcing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor & Sourcing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sourcing Type</Label>
            <Select value={form.sourcingType} onValueChange={(v) => set("sourcingType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GEM">GeM (Government e-Marketplace)</SelectItem>
                <SelectItem value="NON_GEM">Non-GeM (Open Market)</SelectItem>
                <SelectItem value="PROPRIETARY">Proprietary / Single Source</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name</Label>
              <Input value={form.vendorName} onChange={(e) => set("vendorName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor GST Number</Label>
              <Input value={form.vendorGst} onChange={(e) => set("vendorGst", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Vendor Address</Label>
            <Textarea
              rows={2}
              value={form.vendorAddress}
              onChange={(e) => set("vendorAddress", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quotation / Catalogue Reference</Label>
            <Input
              value={form.quoteReference}
              onChange={(e) => set("quoteReference", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button variant="outline" disabled={submitting} onClick={() => handleSave(false)}>
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button disabled={submitting} onClick={() => handleSave(true)}>
          <Send className="h-4 w-4 mr-2" />
          {submitting ? "Submitting…" : "Save & Submit to PI"}
        </Button>
      </div>
    </div>
  );
}