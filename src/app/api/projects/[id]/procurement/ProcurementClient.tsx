"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  FileText,
  PackageCheck,
  Banknote,
  ShoppingCart,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import NewPurchaseRequestForm from "./NewPurchaseRequestForm";
import ChecklistUploadForm from "./ChecklistUploadForm";
import GoodsReceiptForm from "./GoodsReceiptForm";
import PaymentReleaseForm from "./PaymentReleaseForm";

interface ProcurementRequest {
  id: string;
  itemDescription: string;
  estimatedAmount: number;
  sourcingType: string;
  approvalTier: string;
  status: string;
  budgetHead: { name: string };
  submittedBy: { name: string };
  goodsReceipt: { id: string; condition: string; deliveryDate: string } | null;
  paymentReleaseRequest: { id: string; invoiceAmount: number } | null;
  documents: { id: string; documentType: string }[];
  createdAt: string;
}

interface BudgetHead {
  id: string;
  name: string;
  projectId: string;
  balance: number;
}

interface ProcurementClientProps {
  project: { id: string; title: string };
  requests: ProcurementRequest[];
  budgetHeads: BudgetHead[];
  currentUserId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  ORDERED: { label: "Ordered", color: "bg-purple-100 text-purple-800", icon: ShoppingCart },
  RECEIVED: { label: "Received", color: "bg-green-100 text-green-800", icon: PackageCheck },
  PAYMENT_RELEASED: { label: "Paid", color: "bg-green-700 text-white", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: AlertTriangle },
};

const TIER_LABELS: Record<string, string> = {
  NO_QUOTATION: "No Quotation",
  LOCAL_COMMITTEE: "Local Cmte.",
  LIMITED_TENDER: "Limited Tender",
  ADVERTISED_TENDER: "Advertised Tender",
};

export default function ProcurementClient({
  project,
  requests,
  budgetHeads,
  currentUserId,
}: ProcurementClientProps) {
  const [newOpen, setNewOpen] = useState(false);
  const [checklistRequest, setChecklistRequest] = useState<ProcurementRequest | null>(null);
  const [goodsRequest, setGoodsRequest] = useState<ProcurementRequest | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<ProcurementRequest | null>(null);

  function isChecklistComplete(r: ProcurementRequest) {
    return r.documents.length > 0;
  }

  function isGoodsReceived(r: ProcurementRequest) {
    return r.goodsReceipt !== null;
  }

  function isPaid(r: ProcurementRequest) {
    return r.paymentReleaseRequest !== null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Procurement</h1>
          <p className="text-sm text-gray-500 mt-0.5">{project.title}</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Purchase Request
        </Button>
      </div>

      {/* Stats row */}
      {requests.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Requests", value: requests.length, color: "text-gray-900" },
            { label: "Pending Approval", value: requests.filter(r => r.status === "PENDING_APPROVAL").length, color: "text-yellow-700" },
            { label: "Received", value: requests.filter(r => r.status === "RECEIVED").length, color: "text-green-700" },
            { label: "Paid", value: requests.filter(r => r.status === "PAYMENT_RELEASED").length, color: "text-blue-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No purchase requests yet</p>
          <p className="text-sm text-gray-400 mt-1">Create one to start the procurement workflow.</p>
          <Button className="mt-4 gap-2" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New Purchase Request
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-[30%]">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Budget Head</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Progress</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((r) => {
                const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.DRAFT;
                const StatusIcon = statusCfg.icon;
                const checkDone = isChecklistComplete(r);
                const goodsDone = isGoodsReceived(r);
                const paid = isPaid(r);

                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-55">{r.itemDescription}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.sourcingType.replace(/_/g, " ")}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.budgetHead.name}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900">
                      ₹{r.estimatedAmount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {TIER_LABELS[r.approvalTier] || r.approvalTier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${checkDone ? "bg-green-500" : "bg-gray-200"}`} title="Checklist" />
                        <span className={`h-2 w-2 rounded-full ${goodsDone ? "bg-green-500" : "bg-gray-200"}`} title="Goods receipt" />
                        <span className={`h-2 w-2 rounded-full ${paid ? "bg-green-500" : "bg-gray-200"}`} title="Payment" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setChecklistRequest(r)}
                          title="Document Checklist"
                          className={`p-1.5 rounded-md transition-colors ${checkDone ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setGoodsRequest(r)}
                          title="Record Goods Receipt"
                          disabled={goodsDone}
                          className={`p-1.5 rounded-md transition-colors ${goodsDone ? "text-green-600 cursor-default" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                        >
                          <PackageCheck className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPaymentRequest(r)}
                          title="Release Payment"
                          disabled={paid}
                          className={`p-1.5 rounded-md transition-colors ${paid ? "text-green-600 cursor-default" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <p className="text-xs text-gray-400 flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Checklist</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Goods received</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Payment released</span>
      </p>

      {/* Dialogs */}
      <NewPurchaseRequestForm
        open={newOpen}
        onClose={() => setNewOpen(false)}
        projects={[project]}
        budgetHeads={budgetHeads}
        currentUserId={currentUserId}
      />

      {checklistRequest && (
        <ChecklistUploadForm
          open={!!checklistRequest}
          onClose={() => setChecklistRequest(null)}
          requestId={checklistRequest.id}
          requestDescription={checklistRequest.itemDescription}
          approvalTier={checklistRequest.approvalTier}
        />
      )}

      {goodsRequest && !isGoodsReceived(goodsRequest) && (
        <GoodsReceiptForm
          open={!!goodsRequest}
          onClose={() => setGoodsRequest(null)}
          requestId={goodsRequest.id}
          requestDescription={goodsRequest.itemDescription}
          estimatedAmount={goodsRequest.estimatedAmount}
        />
      )}

      {paymentRequest && (
        <PaymentReleaseForm
          open={!!paymentRequest}
          onClose={() => setPaymentRequest(null)}
          requestId={paymentRequest.id}
          requestDescription={paymentRequest.itemDescription}
          estimatedAmount={paymentRequest.estimatedAmount}
          checklistComplete={isChecklistComplete(paymentRequest)}
          goodsReceived={isGoodsReceived(paymentRequest)}
        />
      )}
    </div>
  );
}