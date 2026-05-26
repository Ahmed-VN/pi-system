"use client";

import { useState, useEffect, useRef } from "react";

const DOC_TYPES = [
  "PROPOSAL",
  "PROGRESS_REPORT",
  "EXPENDITURE_STATEMENT",
  "UTILIZATION_CERTIFICATE",
  "COMPLETION_REPORT",
  "OTHER",
];

const DOC_TYPE_LABELS: Record<string, string> = {
  PROPOSAL: "Proposal",
  PROGRESS_REPORT: "Progress Report",
  EXPENDITURE_STATEMENT: "Expenditure Statement",
  UTILIZATION_CERTIFICATE: "Utilization Certificate",
  COMPLETION_REPORT: "Completion Report",
  OTHER: "Other",
};

type Document = {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  project: { title: string; sanctionNumber: string };
};

type Project = {
  id: string;
  title: string;
  sanctionNumber: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return "📄";
  if (mimeType.includes("pdf")) return "📕";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📘";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📗";
  if (mimeType.includes("image")) return "🖼️";
  return "📄";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    title: "",
    documentType: "OTHER",
    projectId: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
    fetchProjects();
  }, []);

  async function fetchDocuments() {
  setLoading(true);
  try {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocuments(Array.isArray(data) ? data : []);
  } catch {
    setDocuments([]);
  }
  setLoading(false);
}

  async function fetchProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
  }

  async function handleUpload() {
    if (!selectedFile || !form.title || !form.projectId) {
      setError("Please fill all fields and select a file.");
      return;
    }
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", form.title);
    formData.append("documentType", form.documentType);
    formData.append("projectId", form.projectId);
    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      setSuccess("Document uploaded successfully!");
      setShowUpload(false);
      setForm({ title: "", documentType: "OTHER", projectId: "" });
      setSelectedFile(null);
      fetchDocuments();
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Upload failed.");
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSuccess("Document deleted.");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  function handleView(fileUrl: string) {
    window.open(fileUrl, "_blank");
  }

  const filtered = documents.filter((d) => {
    const matchType = filterType === "ALL" || d.documentType === filterType;
    const matchProject =
      filterProject === "ALL" || d.project?.sanctionNumber === filterProject;
    const matchSearch =
      search === "" ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.project?.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchProject && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-semibold text-[#1A1A2E]">Documents</h1>
            <p className="text-[13px] text-[#9999AA] mt-0.5">All project files and documents</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] transition-colors"
          >
            + Upload Document
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg">
            {success}
          </div>
        )}

        {showUpload && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h2 className="text-[16px] font-semibold text-[#1A1A2E] mb-4">Upload Document</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium text-[#555570] mb-1 block">Document Title</label>
                  <input
                    className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                    placeholder="e.g. Progress Report Q1 2025"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555570] mb-1 block">Document Type</label>
                  <select
                    className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                    value={form.documentType}
                    onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555570] mb-1 block">Project</label>
                  <select
                    className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                    value={form.projectId}
                    onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                  >
                    <option value="">Select project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.sanctionNumber} — {p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555570] mb-1 block">File (max 10MB)</label>
                  <div
                    className="border-2 border-dashed border-[#EBEBF0] rounded-lg p-4 text-center cursor-pointer hover:border-[#5B4FE9] transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    {selectedFile ? (
                      <p className="text-[13px] text-[#5B4FE9] font-medium">{selectedFile.name}</p>
                    ) : (
                      <p className="text-[13px] text-[#9999AA]">Click to select file</p>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setShowUpload(false); setError(""); setSelectedFile(null); }}
                  className="flex-1 py-2 border border-[#EBEBF0] text-[13px] font-medium text-[#555570] rounded-lg hover:bg-[#F5F5F7]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-[#EBEBF0] rounded-xl p-4 mb-4 flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[180px] border border-[#EBEBF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#5B4FE9]"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-[#EBEBF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#5B4FE9]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            className="border border-[#EBEBF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#5B4FE9]"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.sanctionNumber}>{p.sanctionNumber}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#9999AA] text-[13px]">Loading documents...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#EBEBF0] rounded-2xl p-16 text-center">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">No documents found</p>
            <p className="text-[13px] text-[#9999AA]">Upload your first document to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <div key={doc.id} className="bg-white border border-[#EBEBF0] rounded-xl p-4 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{getFileIcon(doc.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1A1A2E] truncate">{doc.title}</p>
                    <p className="text-[11px] text-[#9999AA] mt-0.5">{DOC_TYPE_LABELS[doc.documentType]}</p>
                    <p className="text-[11px] text-[#9999AA] truncate mt-0.5">{doc.project?.sanctionNumber}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F0F0F5]">
                  <div>
                    <p className="text-[11px] text-[#9999AA]">{doc.fileSize ? formatBytes(doc.fileSize) : "—"}</p>
                    <p className="text-[11px] text-[#9999AA]">{new Date(doc.createdAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleView(doc.fileUrl)}
                      className="px-3 py-1.5 text-[11px] font-medium bg-[#EEF0FF] text-[#5B4FE9] rounded-lg hover:bg-[#E0E4FF] transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}