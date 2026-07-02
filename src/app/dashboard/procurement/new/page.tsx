"use client";

// src/app/dashboard/procurement/new/page.tsx

import { useState, useEffect } from "react";
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

interface Project {
  id: string;
  title: string;
  sanctionNumber: string;
  budgetHeads: BudgetHead[];
}

export default function NewProcurementPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [projects, setProjects]       = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  const [form, setForm] = useState({
    projectId:       "",
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

  // Redirect PI away — they don't create requests
  useEffect(() => {
    if (session?.user?.role === "PI") {
      router.replace("/dashboard/procurement");
    }
  }, [session, router]);

  // Load projects
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error();
        const data = await res.json();
        // data may be an array or { projects: [] }
        const list: Project[] = Array.isArray(data) ? data : data.projects ?? [];
        setProjects(list);
      } catch {
        toast.error("Failed to load projects");
      }
    }
    load();
  }, []);

  function handleProjectChange(projectId: string) {
    const proj = projects.find((p) => p.id === projectId) ?? null;
    setSelectedProject(proj);
    setForm((f) => ({ ...f, projectId, budgetHeadId: "" }));
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(submitNow: boolean) {
    if (
      !form.projectId ||
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
      const res = await fetch("/api/procurement", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, submitNow }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }

      const created = await res.json();
      toast.success(submitNow ? "Request submitted to PI!" : "Draft saved.");
      router.push(`/dashboard/procurement/${created.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/procurement">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Procurement Request</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Fill in the details below and either save as draft or submit directly to the PI.
          </p>
        </div>
      </div>

      {/* Project & Budget Head */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
          <CardDescription>Link this request to a project and budget head.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project <span className="text-destructive">*</span></Label>
            <Select value={form.projectId} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} — {p.sanctionNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Budget Head <span className="text-destructive">*</span></Label>
            <Select
              value={form.budgetHeadId}
              onValueChange={(v) => set("budgetHeadId", v)}
              disabled={!selectedProject}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedProject ? "Select budget head" : "Select a project first"} />
              </SelectTrigger>
              <SelectContent>
                {(selectedProject?.budgetHeads ?? []).map((bh) => (
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
          <CardDescription>Describe what you need to procure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Digital Oscilloscope"
              value={form.itemName}
              onChange={(e) => set("itemName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Item Description / Specification <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Provide full technical specification…"
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
                placeholder="0.00"
                value={form.estimatedCost}
                onChange={(e) => set("estimatedCost", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Justification / Purpose <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Explain the scientific need and how this item will be used in the project…"
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
          <CardDescription>Optional vendor details and procurement route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sourcing Type</Label>
            <Select value={form.sourcingType} onValueChange={(v) => set("sourcingType", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <Input
                placeholder="Supplier / firm name"
                value={form.vendorName}
                onChange={(e) => set("vendorName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor GST Number</Label>
              <Input
                placeholder="22AAAAA0000A1Z5"
                value={form.vendorGst}
                onChange={(e) => set("vendorGst", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Vendor Address</Label>
            <Textarea
              placeholder="Full address of vendor"
              rows={2}
              value={form.vendorAddress}
              onChange={(e) => set("vendorAddress", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quotation / Catalogue Reference</Label>
            <Input
              placeholder="Quote no. or catalogue page ref."
              value={form.quoteReference}
              onChange={(e) => set("quoteReference", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button
          variant="outline"
          disabled={submitting}
          onClick={() => handleSubmit(false)}
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button
          disabled={submitting}
          onClick={() => handleSubmit(true)}
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? "Submitting…" : "Submit to PI"}
        </Button>
      </div>
    </div>
  );
}