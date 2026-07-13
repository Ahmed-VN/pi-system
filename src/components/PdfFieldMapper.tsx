"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type FieldMarker = {
  id: string;
  fieldName: string;
  page: number;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  screenX: number;
  screenY: number;
};

type Props = {
  templateId: string;
  templateName: string;
  initialFields: Array<{
    id?: string;
    fieldName: string;
    page: number;
    x: number;
    y: number;
    width: number;
    fontSize: number;
  }>;
  onClose: () => void;
  onSaved: () => void;
};

export default function PdfFieldMapper({
  templateId,
  templateName,
  initialFields,
  onClose,
  onSaved,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<unknown>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [scale] = useState(1.3);
  const [markers, setMarkers] = useState<FieldMarker[]>([]);
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [fieldNameInput, setFieldNameInput] = useState("");
  const [fieldWidthInput, setFieldWidthInput] = useState("200");
  const [fieldFontSize, setFieldFontSize] = useState("9");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renderTick, setRenderTick] = useState(0);

  const renderPage = useCallback(
    async (pageNum: number) => {
      const doc = pdfDocRef.current;
      if (!doc) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdf = doc as any;

      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;

      try {
        await task.promise;
        setPageHeight(viewport.height);
        setPageWidth(viewport.width);
        setRenderTick((t) => t + 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("cancel")) {
          setError(`Failed to render PDF page: ${msg}`);
        }
      }
    },
    [scale]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib: any = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const res = await fetch(`/api/rag/pdf-template/${templateId}`, { method: "POST" });
        if (!res.ok) throw new Error(`Failed to load PDF (status ${res.status})`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("PDF file is empty.");

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);

        requestAnimationFrame(() => {
          if (!cancelled) renderPage(1);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? `Could not load PDF: ${err.message}` : "Could not load PDF.");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  useEffect(() => {
    if (!pageHeight) return;
    setMarkers(
      initialFields
        .filter((f) => f.page === currentPage)
        .map((f) => ({
          id: f.id || `${f.fieldName}-${f.x}-${f.y}`,
          fieldName: f.fieldName,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          fontSize: f.fontSize,
          screenX: f.x * scale,
          screenY: pageHeight - f.y * scale,
        }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, currentPage]);

  async function handlePageChange(pageNum: number) {
    if (!pdfDocRef.current || pageNum < 1 || pageNum > numPages) return;
    setCurrentPage(pageNum);
    await renderPage(pageNum);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const pdfX = screenX / scale;
    const pdfY = (pageHeight - screenY) / scale;
    setPendingClick({ x: pdfX, y: pdfY, screenX, screenY });
    setFieldNameInput("");
    setFieldWidthInput("200");
    setFieldFontSize("9");
  }

  function confirmField() {
    if (!pendingClick || !fieldNameInput.trim()) return;
    const newMarker: FieldMarker = {
      id: `new-${Date.now()}`,
      fieldName: fieldNameInput.trim(),
      page: currentPage,
      x: pendingClick.x,
      y: pendingClick.y,
      width: Number(fieldWidthInput) || 200,
      fontSize: Number(fieldFontSize) || 9,
      screenX: pendingClick.screenX,
      screenY: pendingClick.screenY,
    };
    setMarkers((prev) => [...prev, newMarker]);
    setPendingClick(null);
    setFieldNameInput("");
  }

  function removeMarker(id: string) {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }

  const allMarkersRef = useRef<Map<number, FieldMarker[]>>(new Map());
  useEffect(() => {
    allMarkersRef.current.set(currentPage, markers);
  }, [markers, currentPage]);

  async function handleSave() {
    allMarkersRef.current.set(currentPage, markers);
    const allMarkers: FieldMarker[] = [];
    allMarkersRef.current.forEach((list) => allMarkers.push(...list));

    if (allMarkers.length === 0) {
      setError("Place at least one field before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/rag/pdf-template/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: allMarkers.map((m) => ({
            fieldName: m.fieldName,
            page: m.page,
            x: m.x,
            y: m.y,
            width: m.width,
            fontSize: m.fontSize,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mapping.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBF0] flex-shrink-0">
          <div>
            <p className="text-[15px] font-semibold text-[#1A1A2E]">Map Fields — {templateName}</p>
            <p className="text-[12px] text-[#9999AA]">Click anywhere on the PDF to place a field marker</p>
          </div>
          <button onClick={onClose} className="text-[#9999AA] hover:text-[#1A1A2E] text-[20px] leading-none px-2">×</button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-lg flex-shrink-0">
            {error}
          </div>
        )}

        {numPages > 1 && (
          <div className="flex items-center gap-2 px-5 pt-3 flex-shrink-0">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}
              className="px-2 py-1 text-[12px] border border-[#EBEBF0] rounded-md disabled:opacity-40">← Prev</button>
            <span className="text-[12px] text-[#555570]">Page {currentPage} of {numPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= numPages}
              className="px-2 py-1 text-[12px] border border-[#EBEBF0] rounded-md disabled:opacity-40">Next →</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-5 bg-[#F5F5F7] min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-[#5B4FE9] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[13px] text-[#9999AA]">Loading PDF...</p>
              </div>
            </div>
          )}

          <div
            className={`relative bg-white shadow-md mx-auto ${loading ? "hidden" : ""}`}
            style={{ width: pageWidth ? `${pageWidth}px` : "100%", minHeight: pageHeight ? `${pageHeight}px` : "400px" }}
          >
            <canvas ref={canvasRef} onClick={handleCanvasClick} className="cursor-crosshair block" />

            {markers.map((m) => (
              <div key={m.id} className="absolute group"
                style={{ left: m.screenX, top: m.screenY, transform: "translate(-2px, -2px)" }}>
                <div className="flex items-center gap-1 bg-[#5B4FE9] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap">
                  📍 {m.fieldName}
                  <span className="opacity-60 ml-1">w:{m.width} f:{m.fontSize}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}
                    className="ml-1 opacity-70 hover:opacity-100">×</button>
                </div>
              </div>
            ))}

            {pendingClick && (
              <div
                className="absolute bg-white border border-[#5B4FE9] rounded-lg shadow-xl p-3 z-10 w-52"
                style={{
                  left: Math.min(pendingClick.screenX, (pageWidth || 600) - 215),
                  top: Math.min(pendingClick.screenY, (pageHeight || 800) - 160),
                }}
              >
                <p className="text-[11px] font-semibold text-[#555570] mb-2">New Field</p>

                <input
                  autoFocus
                  className="text-[12px] border border-[#EBEBF0] rounded px-2 py-1 outline-none w-full mb-2"
                  placeholder="field_name"
                  value={fieldNameInput}
                  onChange={(e) => setFieldNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmField();
                    if (e.key === "Escape") setPendingClick(null);
                  }}
                />

                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-[10px] text-[#9999AA] mb-0.5">Width (pts)</p>
                    <input
                      type="number"
                      className="text-[12px] border border-[#EBEBF0] rounded px-2 py-1 outline-none w-full"
                      value={fieldWidthInput}
                      onChange={(e) => setFieldWidthInput(e.target.value)}
                      min={50}
                      max={500}
                    />
                  </div>
                  <div className="w-16">
                    <p className="text-[10px] text-[#9999AA] mb-0.5">Font size</p>
                    <select
                      className="text-[12px] border border-[#EBEBF0] rounded px-1 py-1 outline-none w-full"
                      value={fieldFontSize}
                      onChange={(e) => setFieldFontSize(e.target.value)}
                    >
                      {[7, 8, 9, 10, 11, 12].map((s) => (
                        <option key={s} value={s}>{s}pt</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-1">
                  <button onClick={confirmField}
                    className="flex-1 text-[11px] bg-[#5B4FE9] text-white py-1.5 rounded font-medium">
                    Add
                  </button>
                  <button onClick={() => setPendingClick(null)}
                    className="flex-1 text-[11px] border border-[#EBEBF0] py-1.5 rounded">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-[#EBEBF0] flex-shrink-0">
          <p className="text-[12px] text-[#9999AA]">
            {markers.length} field{markers.length !== 1 ? "s" : ""} on this page
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-[13px] border border-[#EBEBF0] rounded-lg text-[#555570] hover:bg-[#F5F5F7]">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-[13px] bg-[#5B4FE9] text-white rounded-lg hover:bg-[#4A3FD8] disabled:opacity-50">
              {saving ? "Saving..." : "Save Mapping"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}