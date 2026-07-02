"use client";

// src/app/dashboard/procurement/page.tsx

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Clock, CheckCircle2, XCircle, Send } from "lucide-react";
import { toast } from "sonner";

type ProcurementStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

interface ProcurementRequest {
  id: string;
  itemName: string;
  itemDescription: string;
  quantity: number;
  estimatedCost: number;
  status: ProcurementStatus;
  sourcingType: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: { id: string; name: string; role: string };
  approvedBy:  { id: string; name: string } | null;
  budgetHead:  { id: string; headName: string; category: string };
  project:     { id: string; title: string; sanctionNumber: string };
}

const STATUS_CONFIG: Record<
  ProcurementStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; color: string }
> = {
  DRAFT:     { label: "Draft",     variant: "outline",     icon: <FileText className="h-3 w-3" />,      color: "text-muted-foreground" },
  SUBMITTED: { label: "Submitted", variant: "secondary",   icon: <Send className="h-3 w-3" />,           color: "text-blue-600" },
  APPROVED:  { label: "Approved",  variant: "default",     icon: <CheckCircle2 className="h-3 w-3" />,   color: "text-green-600" },
  REJECTED:  { label: "Rejected",  variant: "destructive", icon: <XCircle className="h-3 w-3" />,        color: "text-red-600" },
};

function StatusBadge({ status }: { status: ProcurementStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

const STATS = (requests: ProcurementRequest[]) => [
  { label: "Total",     count: requests.length,                                          icon: <FileText className="h-4 w-4" />,     color: "text-foreground" },
  { label: "Pending",   count: requests.filter((r) => r.status === "SUBMITTED").length,  icon: <Clock className="h-4 w-4" />,        color: "text-blue-600" },
  { label: "Approved",  count: requests.filter((r) => r.status === "APPROVED").length,   icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-600" },
  { label: "Rejected",  count: requests.filter((r) => r.status === "REJECTED").length,   icon: <XCircle className="h-4 w-4" />,      color: "text-red-600" },
];

export default function ProcurementPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const isPI = session?.user?.role === "PI";

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/procurement");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setRequests(data);
      } catch {
        toast.error("Failed to load procurement requests");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.itemName.toLowerCase().includes(search.toLowerCase()) ||
      r.project.title.toLowerCase().includes(search.toLowerCase()) ||
      r.submittedBy.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = STATS(requests);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isPI
              ? "Review and manage all procurement requests across your projects."
              : "Create and track your procurement requests."}
          </p>
        </div>
        {!isPI && (
          <Button asChild>
            <Link href="/dashboard/procurement/new">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="py-4">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              </div>
              <div className={`${s.color} opacity-70`}>{s.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, project, or submitter…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Requests</CardTitle>
          <CardDescription>
            {filtered.length} of {requests.length} request{requests.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
              <FileText className="h-8 w-8 opacity-40" />
              <span>No procurement requests found.</span>
              {!isPI && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/procurement/new">Create your first request</Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Project</TableHead>
                  {isPI && <TableHead>Submitted By</TableHead>}
                  <TableHead>Estimated Cost</TableHead>
                  <TableHead>Budget Head</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium max-w-45 truncate">
                      {r.itemName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-35 truncate">
                      {r.project.title}
                    </TableCell>
                    {isPI && (
                      <TableCell className="text-sm">{r.submittedBy.name}</TableCell>
                    )}
                    <TableCell className="font-mono text-sm">
                      ₹{r.estimatedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.budgetHead.headName}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/procurement/${r.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}