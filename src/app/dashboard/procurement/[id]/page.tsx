"use client";

// src/app/dashboard/procurement/[id]/page.tsx

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  FileDown,
  Send,
  FileText,
  Clock,
  User,
  Building2,
  CalendarDays,
  Tag,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type ProcurementStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

interface ProcurementRequest {
  id: string;
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
  status: ProcurementStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy: { id: string; name: string; role: string; designation?: string };
  approvedBy: { id: string; name: string } | null;
  budgetHead: {
    id: string;
    headName: string;
    category: string;
    allocatedAmount: number;
  };
  project: {
    id: string;
    title: string;
    sanctionNumber: string;
    grantType: string;
    hostInstitution: string;
    startDate: string;
    endDate: string;
    totalBudget: number;
    pi: { id: string; name: string; designation?: string };
  };
}

const STATUS_CONFIG: Record<
  ProcurementStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  DRAFT:     { label: "Draft",          variant: "outline",     icon: <FileText className="h-3.5 w-3.5" /> },
  SUBMITTED: { label: "Submitted to PI", variant: "secondary",  icon: <Clock className="h-3.5 w-3.5" /> },
  APPROVED:  { label: "Approved",        variant: "default",    icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  REJECTED:  { label: "Rejected",        variant: "destructive",icon: <XCircle className="h-3.5 w-3.5" /> },
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export default function ProcurementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [request, setRequest] = useState<ProcurementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isPI = session?.user?.role === "PI";
  const isOwner = request?.submittedBy.id === session?.user?.id;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/procurement/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setRequest(data);
      } catch {
        toast.error("Failed to load request");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Re-fetch the full record after any action to guarantee fresh state
  async function refresh() {
    try {
      const res = await fetch(`/api/procurement/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequest(data);
    } catch {
      toast.error("Failed to refresh");
    }
  }

  async function doAction(
    action: "approve" | "reject" | "submit",
    extra?: Record<string, unknown>
  ) {
    setActing(true);
    try {
      const res = await fetch(`/api/procurement/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }

      if (action === "approve") toast.success("Request approved!");
      if (action === "reject") {
        toast.success("Request rejected.");
        setRejectOpen(false);
        setRejectReason("");
      }
      if (action === "submit") toast.success("Submitted to PI!");

      // Always re-fetch so UI is guaranteed to reflect DB state
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActing(false);
    }
  }

  async function doDelete() {
    setActing(true);
    try {
      const res = await fetch(`/api/procurement/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Request deleted.");
      router.push("/dashboard/procurement");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActing(false);
      setDeleteOpen(false);
    }
  }

  function downloadForm() {
    window.open(`/api/procurement/${id}/generate-form`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Request not found.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/procurement">Back to Procurement</Link>
        </Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[request.status];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" asChild className="mt-0.5">
            <Link href="/dashboard/procurement">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{request.itemName}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {request.project.title} · {request.project.sanctionNumber}
            </p>
          </div>
        </div>
        <Badge variant={cfg.variant} className="flex items-center gap-1.5 px-3 py-1 w-fit">
          {cfg.icon}
          {cfg.label}
        </Badge>
      </div>

      {/* ── APPROVED: big prominent generate block ─────────── */}
      {request.status === "APPROVED" && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/40 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                Approved by {request.approvedBy?.name ?? request.project.pi.name}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {request.approvedAt
                  ? new Date(request.approvedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : ""}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Download the auto-filled ANRF Procurement Requisition Form and submit it to the Finance Department.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white shrink-0 gap-2"
            onClick={downloadForm}
          >
            <FileDown className="h-5 w-5" />
            Download ANRF Form
          </Button>
        </div>
      )}

      {/* ── REJECTED: reason banner ─────────────────────────── */}
      {request.status === "REJECTED" && request.rejectionReason && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex gap-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Rejected by PI</p>
            <p className="text-sm text-muted-foreground mt-0.5">{request.rejectionReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: item + vendor ────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" /> Item Details
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="Item Name" value={request.itemName} />
              <InfoRow
                label="Description / Specification"
                value={<span className="whitespace-pre-wrap">{request.itemDescription}</span>}
              />
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Quantity" value={request.quantity} />
                <InfoRow
                  label="Estimated Cost"
                  value={
                    <span className="font-mono">
                      ₹{request.estimatedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  }
                />
              </div>
              <InfoRow
                label="Justification / Purpose"
                value={<span className="whitespace-pre-wrap">{request.justification}</span>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Vendor & Sourcing
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="Sourcing Type" value={request.sourcingType.replace(/_/g, " ")} />
              <InfoRow label="Vendor Name" value={request.vendorName} />
              <InfoRow label="Vendor Address" value={request.vendorAddress} />
              <InfoRow label="Vendor GST" value={request.vendorGst} />
              <InfoRow label="Quote / Catalogue Reference" value={request.quoteReference} />
            </CardContent>
          </Card>
        </div>

        {/* ── Right: meta + actions ──────────────────────────── */}
        <div className="space-y-5">

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Project
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              <InfoRow label="Sanction No." value={request.project.sanctionNumber} />
              <InfoRow label="Grant Type"   value={request.project.grantType} />
              <InfoRow
                label="Budget Head"
                value={`${request.budgetHead.headName} (${request.budgetHead.category.replace("_", "-")})`}
              />
              <InfoRow
                label="Allocated"
                value={
                  <span className="font-mono">
                    ₹{request.budgetHead.allocatedAmount.toLocaleString("en-IN")}
                  </span>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Submitted By
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y text-sm">
              <InfoRow label="Name" value={request.submittedBy.name} />
              <InfoRow label="Role" value={request.submittedBy.role.replace("_", "-")} />
              <InfoRow
                label="Date"
                value={new Date(request.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              />
            </CardContent>
          </Card>

          {/* ── PI actions (only when SUBMITTED) ─────────────── */}
          {isPI && request.status === "SUBMITTED" && (
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">PI Review</CardTitle>
                <CardDescription>Approve or reject this request.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => doAction("approve")}
                  disabled={acting}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {acting ? "Processing…" : "Approve"}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setRejectOpen(true)}
                  disabled={acting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── PI delete (always visible to PI) ─────────────── */}
          {isPI && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setDeleteOpen(true)}
                  disabled={acting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Request
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Submitter: submit draft ───────────────────────── */}
          {isOwner && request.status === "DRAFT" && (
            <Card className="border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ready to Submit?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/procurement/${id}/edit`}>Edit Draft</Link>
                </Button>
                <Button
                  className="w-full"
                  onClick={() => doAction("submit")}
                  disabled={acting}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {acting ? "Submitting…" : "Submit to PI"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── Submitter: resubmit after rejection ──────────── */}
          {isOwner && request.status === "REJECTED" && (
            <Card className="border-blue-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resubmit Request</CardTitle>
                <CardDescription>Edit and resubmit to the PI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/procurement/${id}/edit`}>Edit Request</Link>
                </Button>
                <Button
                  className="w-full"
                  onClick={() => doAction("submit")}
                  disabled={acting}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {acting ? "Submitting…" : "Resubmit to PI"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── REJECT DIALOG ─────────────────────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Procurement Request</DialogTitle>
            <DialogDescription>
              The JRF / Co-PI will be notified and can edit and resubmit the request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>
              Reason for Rejection <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Explain why this request is being rejected…"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || acting}
              onClick={() => doAction("reject", { rejectionReason: rejectReason })}
            >
              {acting ? "Rejecting…" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ─────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Procurement Request?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">Are you sure?</span>
              <br />
              This action cannot be undone. The request for{" "}
              <span className="font-semibold">&ldquo;{request.itemName}&rdquo;</span> will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={acting} onClick={doDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              {acting ? "Deleting…" : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />
      <p className="text-xs text-muted-foreground pb-6">
        Request ID: {request.id} · Last updated:{" "}
        {new Date(request.updatedAt).toLocaleString("en-IN")}
      </p>
    </div>
  );
}