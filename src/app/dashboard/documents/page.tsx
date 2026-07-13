"use client";

import { useState, useEffect, useRef } from "react";
import PdfFieldMapper from "@/components/PdfFieldMapper";

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

type PdfTemplateField = {
  id: string;
  fieldName: string;
  page: number;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

type PdfTemplate = {
  id: string;
  name: string;
  pageCount: number;
  createdAt: string;
  fields: PdfTemplateField[];
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
  // --- existing state ---
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
  const [form, setForm] = useState({ title: "", documentType: "OTHER", projectId: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- tabs ---
  const [activeTab, setActiveTab] = useState<"documents" | "ai" | "fill" | "templates">("documents");

  // --- AI tab state ---
  const [aiProjectId, setAiProjectId] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiUploading, setAiUploading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiAsking, setAiAsking] = useState(false);
  const [aiDocs, setAiDocs] = useState<string[]>([]);
  const [aiError, setAiError] = useState("");
  const aiFileRef = useRef<HTMLInputElement>(null);

  // --- Fill Form tab state ---
  const [fillProjectId, setFillProjectId] = useState("");
  const [fillFile, setFillFile] = useState<File | null>(null);
  const [fillLoading, setFillLoading] = useState(false);
  const [fillError, setFillError] = useState("");
  const [fillProgress, setFillProgress] = useState("");
  const fillFileRef = useRef<HTMLInputElement>(null);

  // --- Templates tab state ---
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [templatesProjectId, setTemplatesProjectId] = useState("");
  const [templateUploadFile, setTemplateUploadFile] = useState<File | null>(null);
  const [templateUploadName, setTemplateUploadName] = useState("");
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [mappingTemplate, setMappingTemplate] = useState<PdfTemplate | null>(null);
  const [fillingTemplateId, setFillingTemplateId] = useState<string | null>(null);
  const [templateFillProgress, setTemplateFillProgress] = useState({ current: 0, total: 0, fieldName: "" });
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const templateFileRef = useRef<HTMLInputElement>(null);

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
    const res = await fetch("/api/documents", { method: "POST", body: formData });
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

  // --- AI functions ---
  async function fetchAiDocs(projectId: string) {
    const res = await fetch(`/api/rag/documents?projectId=${projectId}`);
    const data = await res.json();
    setAiDocs(data.documents || []);
  }

  async function handleAiUpload() {
    if (!aiFile || !aiProjectId) { setAiError("Select a project and file."); return; }
    setAiUploading(true);
    setAiError("");
    const formData = new FormData();
    formData.append("file", aiFile);
    formData.append("projectId", aiProjectId);
    const res = await fetch("/api/rag/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) setAiError(data.error);
    else { setAiFile(null); fetchAiDocs(aiProjectId); }
    setAiUploading(false);
  }

  async function handleAiAsk() {
    if (!aiProjectId || !aiQuestion) { setAiError("Select a project and enter a question."); return; }
    setAiAsking(true);
    setAiError("");
    setAiAnswer("");
    const res = await fetch("/api/rag/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: aiProjectId, question: aiQuestion }),
    });
    const data = await res.json();
    if (data.error) setAiError(data.error);
    else setAiAnswer(data.answer);
    setAiAsking(false);
  }

  // --- Fill Form function ---
  async function handleFillForm() {
    if (!fillFile || !fillProjectId) { setFillError("Select a project and upload a PDF form."); return; }
    setFillLoading(true);
    setFillError("");
    setFillProgress("Uploading file and reading fields...");
    const formData = new FormData();
    formData.append("pdfFile", fillFile);
    formData.append("projectId", fillProjectId);
    setFillProgress("Querying RAG pipeline for each field. This may take a while (≈15–30s per field)...");
    const res = await fetch("/api/rag/fill-form", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json();
      setFillError(data.error || "Something went wrong.");
      setFillLoading(false);
      setFillProgress("");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filled_${fillFile.name}`;
    a.click();
    URL.revokeObjectURL(url);
    setFillProgress("");
    setFillLoading(false);
    setFillFile(null);
    if (fillFileRef.current) fillFileRef.current.value = "";
  }

  // --- Templates functions ---
  async function fetchTemplates(projectId: string) {
    if (!projectId) return;
    const res = await fetch(`/api/rag/pdf-template?projectId=${projectId}`);
    const data = await res.json();
    setTemplates(data.templates || []);
  }

  async function handleTemplateUpload() {
    if (!templateUploadFile || !templatesProjectId || !templateUploadName) {
      setTemplateError("Select a project, name the template, and choose a PDF.");
      return;
    }
    setTemplateUploading(true);
    setTemplateError("");
    const formData = new FormData();
    formData.append("file", templateUploadFile);
    formData.append("projectId", templatesProjectId);
    formData.append("name", templateUploadName);
    const res = await fetch("/api/rag/pdf-template", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) {
      setTemplateError(data.error);
    } else {
      setTemplateUploadFile(null);
      setTemplateUploadName("");
      if (templateFileRef.current) templateFileRef.current.value = "";
      fetchTemplates(templatesProjectId);
    }
    setTemplateUploading(false);
  }

  async function handleTemplateDelete(id: string) {
    if (!confirm("Delete this template and its field mappings?")) return;
    const res = await fetch(`/api/rag/pdf-template/${id}`, { method: "DELETE" });
    if (res.ok) fetchTemplates(templatesProjectId);
  }

  async function handleTemplateFill(templateId: string) {
    setFillingTemplateId(templateId);
    setTemplateError("");
    setTemplateFillProgress({ current: 0, total: 0, fieldName: "" });
    setPreviewBase64(null);

    try {
      const res = await fetch(`/api/rag/pdf-template/${templateId}/fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: templatesProjectId, streamProgress: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fill failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "progress") {
              setTemplateFillProgress({ current: event.current, total: event.total, fieldName: event.fieldName });
            } else if (event.type === "error") {
              throw new Error(event.message);
            } else if (event.type === "done") {
              const tpl = templates.find((t) => t.id === templateId);
              setPreviewBase64(event.base64);
              setPreviewFileName(event.fileName || `filled_${tpl?.name || "template"}.pdf`);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && !parseErr.message.includes("JSON")) {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Failed to fill template.");
    }

    setFillingTemplateId(null);
    setTemplateFillProgress({ current: 0, total: 0, fieldName: "" });
  }

  const filtered = documents.filter((d) => {
    const matchType = filterType === "ALL" || d.documentType === filterType;
    const matchProject = filterProject === "ALL" || d.project?.sanctionNumber === filterProject;
    const matchSearch =
      search === "" ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.project?.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchProject && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-semibold text-[#1A1A2E]">Documents</h1>
            <p className="text-[13px] text-[#9999AA] mt-0.5">All project files and documents</p>
          </div>
          {activeTab === "documents" && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] transition-colors"
            >
              + Upload Document
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["documents", "ai", "fill", "templates"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-[#5B4FE9] text-white"
                  : "bg-white border border-[#EBEBF0] text-[#555570] hover:bg-[#F5F5F7]"
              }`}
            >
              {tab === "documents" && "📂 Documents"}
              {tab === "ai" && "🤖 AI Assistant"}
              {tab === "fill" && "📝 Fill Form"}
              {tab === "templates" && "🗺️ Templates"}
            </button>
          ))}
        </div>

        {/* ───── TEMPLATES TAB ───── */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            {templateError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">
                {templateError}
              </div>
            )}

            <div className="bg-white border border-[#EBEBF0] rounded-xl p-5 space-y-4">
              <div>
                <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">Flat PDF Templates</p>
                <p className="text-[12px] text-[#9999AA]">
                  For scanned or non-fillable PDFs. Upload once, click to map field positions,
                  then reuse the same template to auto-fill with RAG data anytime.
                </p>
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#555570] mb-1.5 block">Select Project</label>
                <select
                  className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                  value={templatesProjectId}
                  onChange={(e) => { setTemplatesProjectId(e.target.value); if (e.target.value) fetchTemplates(e.target.value); }}
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.sanctionNumber} — {p.title}</option>
                  ))}
                </select>
              </div>

              {templatesProjectId && (
                <div className="border-t border-[#F0F0F5] pt-4 space-y-3">
                  <p className="text-[12px] font-semibold text-[#1A1A2E]">Upload New Template</p>
                  <input
                    className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                    placeholder="Template name (e.g. DST Annual Report Form)"
                    value={templateUploadName}
                    onChange={(e) => setTemplateUploadName(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <div
                      className="flex-1 border-2 border-dashed border-[#EBEBF0] rounded-lg p-3 text-center cursor-pointer hover:border-[#5B4FE9] transition-colors"
                      onClick={() => templateFileRef.current?.click()}
                    >
                      <p className="text-[13px] text-[#9999AA]">
                        {templateUploadFile ? `📕 ${templateUploadFile.name}` : "Click to select flat PDF"}
                      </p>
                      <input ref={templateFileRef} type="file" className="hidden" accept=".pdf"
                        onChange={(e) => setTemplateUploadFile(e.target.files?.[0] || null)} />
                    </div>
                    <button onClick={handleTemplateUpload} disabled={templateUploading}
                      className="px-4 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50">
                      {templateUploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {templatesProjectId && (
              <div className="space-y-3">
                {templates.length === 0 ? (
                  <div className="bg-white border border-[#EBEBF0] rounded-xl p-10 text-center">
                    <p className="text-[13px] text-[#9999AA]">No templates uploaded for this project yet.</p>
                  </div>
                ) : (
                  templates.map((tpl) => (
                    <div key={tpl.id} className="bg-white border border-[#EBEBF0] rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold text-[#1A1A2E]">📕 {tpl.name}</p>
                          <p className="text-[11px] text-[#9999AA] mt-0.5">
                            {tpl.pageCount} page{tpl.pageCount !== 1 ? "s" : ""} · {tpl.fields.length} field{tpl.fields.length !== 1 ? "s" : ""} mapped
                            {tpl.fields.length === 0 && " · needs mapping"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setMappingTemplate(tpl)}
                            className="px-3 py-1.5 text-[11px] font-medium bg-[#EEF0FF] text-[#5B4FE9] rounded-lg hover:bg-[#E0E4FF]">
                            {tpl.fields.length === 0 ? "Map Fields" : "Edit Mapping"}
                          </button>
                          <button
                            onClick={() => handleTemplateFill(tpl.id)}
                            disabled={tpl.fields.length === 0 || fillingTemplateId === tpl.id}
                            className="px-3 py-1.5 text-[11px] font-medium bg-[#5B4FE9] text-white rounded-lg hover:bg-[#4A3FD8] disabled:opacity-40"
                          >
                            {fillingTemplateId === tpl.id ? "Filling..." : "Auto-Fill"}
                          </button>
                          <button onClick={() => handleTemplateDelete(tpl.id)}
                            className="px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Progress bar — shown only while this template is filling */}
                      {fillingTemplateId === tpl.id && templateFillProgress.total > 0 && (
                        <div className="mt-3 p-3 bg-[#EEF0FF] border border-[#C7CCFF] rounded-lg">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] text-[#5B4FE9] font-medium">
                              Filling field {templateFillProgress.current} of {templateFillProgress.total}
                            </p>
                            <p className="text-[11px] text-[#9999AA]">
                              {Math.round((templateFillProgress.current / templateFillProgress.total) * 100)}%
                            </p>
                          </div>
                          <div className="w-full bg-[#D8DAFF] rounded-full h-1.5">
                            <div
                              className="bg-[#5B4FE9] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${(templateFillProgress.current / templateFillProgress.total) * 100}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-[#9999AA] mt-1.5 truncate">
                            Querying: <span className="font-mono">{templateFillProgress.fieldName}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Preview modal */}
            {previewBase64 && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBF0]">
                    <p className="text-[14px] font-semibold text-[#1A1A2E]">✅ Form Filled — Preview</p>
                    <button onClick={() => setPreviewBase64(null)}
                      className="text-[#9999AA] hover:text-[#1A1A2E] text-[20px] leading-none px-2">×</button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-[#F5F5F7]">
                    <iframe
                      src={`data:application/pdf;base64,${previewBase64}`}
                      className="w-full rounded-lg border border-[#EBEBF0]"
                      style={{ height: "60vh" }}
                    />
                  </div>
                  <div className="flex gap-3 px-5 py-4 border-t border-[#EBEBF0]">
                    <button onClick={() => setPreviewBase64(null)}
                      className="flex-1 py-2 border border-[#EBEBF0] text-[13px] font-medium text-[#555570] rounded-lg hover:bg-[#F5F5F7]">
                      Close
                    </button>
                    <button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `data:application/pdf;base64,${previewBase64}`;
                        link.download = previewFileName;
                        link.click();
                      }}
                      className="flex-1 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8]"
                    >
                      ⬇️ Download
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mappingTemplate && (
              <PdfFieldMapper
                templateId={mappingTemplate.id}
                templateName={mappingTemplate.name}
                initialFields={mappingTemplate.fields}
                onClose={() => setMappingTemplate(null)}
                onSaved={() => { setMappingTemplate(null); fetchTemplates(templatesProjectId); }}
              />
            )}
          </div>
        )}

        {/* ───── FILL FORM TAB ───── */}
        {activeTab === "fill" && (
          <div className="space-y-4">
            {fillError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">{fillError}</div>
            )}
            <div className="bg-white border border-[#EBEBF0] rounded-xl p-5 space-y-4">
              <div>
                <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">PDF Form Auto-Fill</p>
                <p className="text-[12px] text-[#9999AA]">
                  Upload a fillable PDF form. Each field name will be queried against the project&apos;s
                  ingested documents and auto-filled with the RAG answer.
                  Only interactive PDF forms with AcroForm fields are supported — not scanned or flat PDFs.
                </p>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#555570] mb-1.5 block">Select Project</label>
                <select className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                  value={fillProjectId} onChange={(e) => setFillProjectId(e.target.value)}>
                  <option value="">Select project...</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.sanctionNumber} — {p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#555570] mb-1.5 block">Upload Fillable PDF</label>
                <div className="border-2 border-dashed border-[#EBEBF0] rounded-lg p-5 text-center cursor-pointer hover:border-[#5B4FE9] transition-colors"
                  onClick={() => fillFileRef.current?.click()}>
                  {fillFile ? (
                    <div>
                      <p className="text-[13px] text-[#5B4FE9] font-medium">📕 {fillFile.name}</p>
                      <p className="text-[11px] text-[#9999AA] mt-1">{formatBytes(fillFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl mb-1">📋</p>
                      <p className="text-[13px] text-[#9999AA]">Click to select a fillable PDF form</p>
                      <p className="text-[11px] text-[#9999AA] mt-1">Must have interactive form fields (AcroForm)</p>
                    </div>
                  )}
                  <input ref={fillFileRef} type="file" className="hidden" accept=".pdf"
                    onChange={(e) => { setFillFile(e.target.files?.[0] || null); setFillError(""); }} />
                </div>
              </div>
              <button onClick={handleFillForm} disabled={fillLoading || !fillFile || !fillProjectId}
                className="w-full py-2.5 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {fillLoading ? "Filling form..." : "Auto-Fill & Download"}
              </button>
              {fillProgress && (
                <div className="p-4 bg-[#EEF0FF] border border-[#C7CCFF] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-[#5B4FE9] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <p className="text-[12px] text-[#5B4FE9]">{fillProgress}</p>
                  </div>
                  <p className="text-[11px] text-[#9999AA] mt-2 ml-7">
                    The LLM runs locally on CPU — expect ~15–30s per field. Please don&apos;t close this tab.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white border border-[#EBEBF0] rounded-xl p-4">
              <p className="text-[12px] font-semibold text-[#555570] mb-2">How it works</p>
              <ol className="text-[12px] text-[#9999AA] space-y-1 list-decimal list-inside">
                <li>Your PDF&apos;s form field names are extracted (e.g. <span className="font-mono bg-[#F5F5F7] px-1 rounded">principal_investigator</span>)</li>
                <li>Each field name is sent as a question to the RAG pipeline</li>
                <li>The answer from your ingested documents fills that field</li>
                <li>The filled PDF is returned as an instant download</li>
              </ol>
            </div>
          </div>
        )}

        {/* ───── AI TAB ───── */}
        {activeTab === "ai" && (
          <div className="space-y-4">
            {aiError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">{aiError}</div>}
            <div className="bg-white border border-[#EBEBF0] rounded-xl p-4">
              <label className="text-[12px] font-medium text-[#555570] mb-2 block">Select Project</label>
              <select className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                value={aiProjectId}
                onChange={(e) => { setAiProjectId(e.target.value); if (e.target.value) fetchAiDocs(e.target.value); }}>
                <option value="">Select project...</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.sanctionNumber} — {p.title}</option>)}
              </select>
            </div>
            <div className="bg-white border border-[#EBEBF0] rounded-xl p-4">
              <p className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Upload Document for AI</p>
              <div className="flex gap-3 items-center">
                <div className="flex-1 border-2 border-dashed border-[#EBEBF0] rounded-lg p-3 text-center cursor-pointer hover:border-[#5B4FE9] transition-colors"
                  onClick={() => aiFileRef.current?.click()}>
                  <p className="text-[13px] text-[#9999AA]">{aiFile ? aiFile.name : "Click to select file (PDF, DOCX, XLSX, CSV, TXT)"}</p>
                  <input ref={aiFileRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                    onChange={(e) => setAiFile(e.target.files?.[0] || null)} />
                </div>
                <button onClick={handleAiUpload} disabled={aiUploading}
                  className="px-4 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50">
                  {aiUploading ? "Processing..." : "Ingest"}
                </button>
              </div>
              {aiDocs.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] text-[#9999AA] mb-1">Ingested documents:</p>
                  <div className="flex flex-wrap gap-2">
                    {aiDocs.map((doc) => (
                      <span key={doc} className="px-2 py-1 bg-[#EEF0FF] text-[#5B4FE9] text-[11px] rounded-md">{doc}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white border border-[#EBEBF0] rounded-xl p-4">
              <p className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Ask a Question</p>
              <div className="flex gap-3">
                <input className="flex-1 border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                  placeholder="e.g. Who wrote this paper? What is the budget?"
                  value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiAsk()} />
                <button onClick={handleAiAsk} disabled={aiAsking}
                  className="px-4 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50">
                  {aiAsking ? "Thinking..." : "Ask"}
                </button>
              </div>
              {aiAnswer && (
                <div className="mt-4 p-4 bg-[#F5F5F7] rounded-xl">
                  <p className="text-[11px] font-medium text-[#9999AA] mb-1">Answer:</p>
                  <p className="text-[13px] text-[#1A1A2E] whitespace-pre-wrap">{aiAnswer}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───── DOCUMENTS TAB ───── */}
        {activeTab === "documents" && (
          <>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">{error}</div>}
            {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg">{success}</div>}

            {showUpload && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                  <h2 className="text-[16px] font-semibold text-[#1A1A2E] mb-4">Upload Document</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[12px] font-medium text-[#555570] mb-1 block">Document Title</label>
                      <input className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                        placeholder="e.g. Progress Report Q1 2025" value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-[#555570] mb-1 block">Document Type</label>
                      <select className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                        value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}>
                        {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-[#555570] mb-1 block">Project</label>
                      <select className="w-full border border-[#EBEBF0] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#5B4FE9]"
                        value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                        <option value="">Select project...</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.sanctionNumber} — {p.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-[#555570] mb-1 block">File (max 10MB)</label>
                      <div className="border-2 border-dashed border-[#EBEBF0] rounded-lg p-4 text-center cursor-pointer hover:border-[#5B4FE9] transition-colors"
                        onClick={() => fileRef.current?.click()}>
                        {selectedFile
                          ? <p className="text-[13px] text-[#5B4FE9] font-medium">{selectedFile.name}</p>
                          : <p className="text-[13px] text-[#9999AA]">Click to select file</p>}
                        <input ref={fileRef} type="file" className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => { setShowUpload(false); setError(""); setSelectedFile(null); }}
                      className="flex-1 py-2 border border-[#EBEBF0] text-[13px] font-medium text-[#555570] rounded-lg hover:bg-[#F5F5F7]">
                      Cancel
                    </button>
                    <button onClick={handleUpload} disabled={uploading}
                      className="flex-1 py-2 bg-[#5B4FE9] text-white text-[13px] font-medium rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50">
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-[#EBEBF0] rounded-xl p-4 mb-4 flex flex-wrap gap-3">
              <input className="flex-1 min-w-[180px] border border-[#EBEBF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#5B4FE9]"
                placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="border border-[#EBEBF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#5B4FE9]"
                value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="ALL">All Types</option>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
              </select>
              <select className="border border-[#EBEBF0] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#5B4FE9]"
                value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="ALL">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.sanctionNumber}>{p.sanctionNumber}</option>)}
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
                        <button onClick={() => handleView(doc.fileUrl)}
                          className="px-3 py-1.5 text-[11px] font-medium bg-[#EEF0FF] text-[#5B4FE9] rounded-lg hover:bg-[#E0E4FF] transition-colors">
                          View
                        </button>
                        <button onClick={() => handleDelete(doc.id)}
                          className="px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}