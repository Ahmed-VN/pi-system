"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";

const DOC_TYPES = [
  { value: "PROPOSAL", label: "Proposal" },
  { value: "PROGRESS_REPORT", label: "Progress Report" },
  { value: "EXPENDITURE_STATEMENT", label: "Expenditure Statement" },
  { value: "UTILIZATION_CERTIFICATE", label: "Utilization Certificate" },
  { value: "COMPLETION_REPORT", label: "Completion Report" },
  { value: "OTHER", label: "Other" },
];

interface UploadDocumentFormProps {
  projectId: string;
  onSuccess: () => void;
}

export default function UploadDocumentForm({ projectId, onSuccess }: UploadDocumentFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // today's date in YYYY-MM-DD for min attribute
  const todayStr = new Date().toISOString().split("T")[0];

  function reset() {
    setFile(null);
    setTitle("");
    setDocType("");
    setExpiryDate("");
  }

  function handleFile(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleSubmit() {
    if (!file) return toast.error("Please select a file");
    if (!title.trim()) return toast.error("Please enter a title");
    if (!docType) return toast.error("Please select a document type");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("documentType", docType);
      fd.append("projectId", projectId);
      if (expiryDate) fd.append("expiryDate", expiryDate);

      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }

      toast.success(`"${title}" uploaded successfully`);
      reset();
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#5B4FE9", color: "#fff", fontSize: 12, fontWeight: 601,
          padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
        }}
      >
        ↑ Upload Document
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
      zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,.2)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #EBEBF0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>Upload Document</div>
            <div style={{ fontSize: 12, color: "#9999AA", marginTop: 2 }}>Max file size: 10MB</div>
          </div>
          <button
            onClick={() => { setOpen(false); reset(); }}
            style={{
              background: "#F5F5F7", border: "none", borderRadius: 8,
              width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#9999AA",
            }}
          >✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            style={{
              border: `2px dashed ${dragOver ? "#5B4FE9" : file ? "#4CAF50" : "#EBEBF0"}`,
              borderRadius: 12,
              background: dragOver ? "#EEF2FF" : file ? "#F1F8E9" : "#FAFAFE",
              padding: "28px 16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all .2s",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2E7D32" }}>{file.name}</div>
                <div style={{ fontSize: 11, color: "#9999AA", marginTop: 4 }}>
                  {(file.size / 1024).toFixed(0)} KB · Click to change
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                  Drop file here or click to browse
                </div>
                <div style={{ fontSize: 11, color: "#9999AA", marginTop: 4 }}>
                  PDF, Word, Excel, images supported
                </div>
              </>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1A2E", display: "block", marginBottom: 6 }}>
              Document Title <span style={{ color: "#E53935" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Progress Report 2025"
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                border: "1px solid #EBEBF0", borderRadius: 8, outline: "none",
                color: "#1A1A2E", background: "#FAFAFE", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Document type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1A2E", display: "block", marginBottom: 6 }}>
              Document Type <span style={{ color: "#E53935" }}>*</span>
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                border: "1px solid #EBEBF0", borderRadius: 8, outline: "none",
                color: docType ? "#1A1A2E" : "#9999AA", background: "#FAFAFE",
                boxSizing: "border-box", cursor: "pointer",
              }}
            >
              <option value="">Select type…</option>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Expiry Date — optional */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1A2E", display: "block", marginBottom: 6 }}>
              Expiry Date
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 600,
                background: "#F3F4F6", color: "#9999AA",
                padding: "2px 6px", borderRadius: 4,
              }}>
                Optional
              </span>
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                fontSize: 15, pointerEvents: "none",
              }}>📅</span>
              <input
                type="date"
                value={expiryDate}
                min={todayStr}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px 10px 34px", fontSize: 13,
                  border: `1px solid ${expiryDate ? "#5B4FE9" : "#EBEBF0"}`,
                  borderRadius: 8, outline: "none",
                  color: expiryDate ? "#1A1A2E" : "#9999AA",
                  background: expiryDate ? "#F5F3FF" : "#FAFAFE",
                  boxSizing: "border-box", cursor: "pointer",
                  transition: "all .15s",
                }}
              />
            </div>
            {expiryDate && (
              <div style={{
                marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 11, color: "#5B4FE9", fontWeight: 600 }}>
                  Expires: {new Date(expiryDate + "T00:00:00").toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => setExpiryDate("")}
                  style={{
                    background: "none", border: "none", fontSize: 11,
                    color: "#9999AA", cursor: "pointer", textDecoration: "underline",
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid #EBEBF0",
          display: "flex", gap: 10, justifyContent: "flex-end",
        }}>
          <button
            onClick={() => { setOpen(false); reset(); }}
            disabled={loading}
            style={{
              padding: "9px 18px", fontSize: 13, fontWeight: 600,
              border: "1px solid #EBEBF0", borderRadius: 8, background: "#fff",
              color: "#9999AA", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            style={{
              padding: "9px 20px", fontSize: 13, fontWeight: 600,
              border: "none", borderRadius: 8, cursor: loading || !file ? "not-allowed" : "pointer",
              background: loading || !file ? "#C7D2FE" : "#5B4FE9",
              color: "#fff", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  display: "inline-block", animation: "spin .7s linear infinite",
                }} />
                Uploading…
              </>
            ) : "Upload"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}