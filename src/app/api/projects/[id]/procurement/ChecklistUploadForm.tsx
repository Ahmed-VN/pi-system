"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Upload, Loader2, FileText, AlertTriangle } from "lucide-react";

interface ChecklistItem {
  type: string;
  label: string;
  uploaded: boolean;
  documentId?: string;
}

interface ChecklistUploadFormProps {
  open: boolean;
  onClose: () => void;
  requestId: string;
  requestDescription: string;
  approvalTier: string;
}

const DOCUMENT_LABELS: Record<string, string> = {
  QUOTATION_1: "Quotation 1",
  QUOTATION_2: "Quotation 2",
  QUOTATION_3: "Quotation 3",
  GEM_SCREENSHOT: "GeM Portal Screenshot",
  COMPARATIVE_STATEMENT: "Comparative Statement",
  COMMITTEE_REPORT: "Purchase Committee Report",
  SANCTION_LETTER: "Sanction / Approval Letter",
  INDENT_FORM: "Indent Form",
  PROPRIETARY_CERTIFICATE: "Proprietary Article Certificate",
  PURCHASE_ORDER: "Purchase Order Copy",
};

export default function ChecklistUploadForm({
  open,
  onClose,
  requestId,
  requestDescription,
  approvalTier,
}: ChecklistUploadFormProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !requestId) return;

    let active = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset before fetch; guarded by `active` below
    setLoading(true);
    setError("");

    fetch(`/api/procurement/requests/${requestId}/documents`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setChecklist(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setError("Failed to load checklist");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, requestId]);

  async function handleUpload(docType: string, file: File) {
    setError("");
    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);

      const res = await fetch(`/api/procurement/requests/${requestId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Refresh checklist
      const refreshed = await fetch(`/api/procurement/requests/${requestId}/documents`);
      const refreshedData = await refreshed.json();
      setChecklist(Array.isArray(refreshedData) ? refreshedData : []);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  }

  const uploadedCount = checklist.filter((c) => c.uploaded).length;
  const totalCount = checklist.length;
  const allDone = totalCount > 0 && uploadedCount === totalCount;

  const tierColors: Record<string, string> = {
    PETTY_CASH: "bg-green-100 text-green-800",
    PI_APPROVAL: "bg-blue-100 text-blue-800",
    LOCAL_COMMITTEE: "bg-yellow-100 text-yellow-800",
    INSTITUTE_COMMITTEE: "bg-red-100 text-red-800",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-blue-600" />
            Document Checklist
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1 truncate">{requestDescription}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tier + progress */}
          <div className="flex items-center justify-between">
            <Badge className={tierColors[approvalTier] || "bg-gray-100 text-gray-700"}>
              {approvalTier?.replace(/_/g, " ")}
            </Badge>
            {!loading && (
              <span className="text-sm text-gray-500">
                {uploadedCount} / {totalCount} uploaded
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!loading && totalCount > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${(uploadedCount / totalCount) * 100}%` }}
              />
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : checklist.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No documents required for this request.</p>
          ) : (
            <div className="space-y-3">
              {checklist.map((item) => (
                <div
                  key={item.type}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.uploaded
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.uploaded ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                    )}
                    <span className={`text-sm ${item.uploaded ? "text-green-800" : "text-gray-700"}`}>
                      {DOCUMENT_LABELS[item.type] || item.label || item.type}
                    </span>
                  </div>

                  {!item.uploaded && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        disabled={uploading === item.type}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(item.type, f);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="pointer-events-none h-7 text-xs"
                        disabled={uploading === item.type}
                      >
                        {uploading === item.type ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* All done banner */}
          {allDone && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-800 font-medium">
                All documents uploaded — you can now release payment.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}