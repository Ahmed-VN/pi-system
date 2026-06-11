"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AddMilestoneForm from "./AddMilestoneForm";
import MilestoneStatusButton from "./MilestoneStatusButton";
import AddTeamMemberForm from "./AddTeamMemberForm";
import AddExpenditureForm from "./AddExpenditureForm";
import FinanceToolbar from "./FinanceToolbar";
import UploadDocumentForm from "./UploadDocumentForm";
import MessagingTab from './MessagingTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User { id: string; name: string; email: string; role?: string; }
interface Expenditure {
  id: string; amount: number; description: string; date: string;
  invoiceNumber?: string | null; vendor?: string | null; createdAt: string;
}
interface BudgetHead {
  id: string; name: string; allocatedAmount: number;
  category: string; expenditures: Expenditure[];
}
interface Milestone {
  id: string; title: string; description?: string | null;
  dueDate: string; completedAt?: string | null; status: string; createdAt: string;
}
interface PersonnelRecord {
  id: string; role: string; stipend: number | null; joinDate: string | null; user: User;
}
interface Document {
  id: string; name: string; type: string; url: string; uploadedAt: string;
}
interface Project {
  id: string; title: string; sanctionNumber: string; grantType: string;
  status: string; totalBudget: number; startDate: string; endDate: string;
  description?: string | null; pi: User; milestones: Milestone[];
  budgetHeads: BudgetHead[]; personnelRecords: PersonnelRecord[]; documents: Document[];
}

// ─── Permissions ──────────────────────────────────────────────────────────────

function can(role: string) {
  return {
    addMilestone:      role === "PI" || role === "CO_PI",
    deleteMilestone:   role === "PI",
    updateMilestone:   role === "PI" || role === "CO_PI",
    addTeamMember:     role === "PI",
    removeTeamMember:  role === "PI",
    viewFinancials:    role === "PI" || role === "CO_PI",
    addExpenditure:    role === "PI",
    deleteExpenditure: role === "PI",
    addBudgetHead:     role === "PI",
    deleteBudgetHead:  role === "PI",
    uploadDocument:    role === "PI" || role === "CO_PI" || role === "JRF",
    deleteDocument:    role === "PI" || role === "CO_PI" || role === "JRF",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function inr(n: number) { return `₹${n.toLocaleString("en-IN")}`; }
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const MILESTONE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:     { label: "Pending",     bg: "#FFF8E1", color: "#F57F17" },
  IN_PROGRESS: { label: "In Progress", bg: "#E8EAF6", color: "#3949AB" },
  COMPLETED:   { label: "Completed",   bg: "#E8F5E9", color: "#2E7D32" },
  DELAYED:     { label: "Delayed",     bg: "#FFEBEE", color: "#C62828" },
};

const ROLE_LABELS: Record<string, string> = {
  PI: "Principal Investigator", CO_PI: "Co-PI", JRF: "JRF", ADMIN: "Admin",
};

const AVATAR_COLORS = ["#5B4FE9","#7C6FF7","#4CAF50","#2196F3","#FF9800","#E91E63"];

type Tab = "overview" | "milestones" | "team" | "financials" | "documents" | "messages";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview", milestones: "Milestones", team: "Team",
  financials: "Financials", documents: "Documents", messages: "💬 Messages",
};

// ─── Inline Add Budget Head Form ──────────────────────────────────────────────

function AddBudgetHeadInline({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [headName, setHeadName] = useState("");
  const [category, setCategory] = useState<"RECURRING" | "NON_RECURRING">("RECURRING");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ headName?: string; allocatedAmount?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!headName.trim()) e.headName = "Name is required";
    if (!allocatedAmount || isNaN(Number(allocatedAmount)) || Number(allocatedAmount) <= 0)
      e.allocatedAmount = "Enter a valid amount";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/budget-heads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          headName: headName.trim(),
          category,
          allocatedAmount: Number(allocatedAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to add budget head"); return; }
      toast.success(`Budget head "${headName}" added`);
      setHeadName("");
      setAllocatedAmount("");
      setCategory("RECURRING");
      setErrors({});
      setOpen(false);
      onSuccess();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "#EEF2FF", border: "1.5px dashed #A5B4FC",
          borderRadius: 10, padding: "12px 16px", width: "100%",
          fontSize: 13, fontWeight: 600, color: "#5B4FE9",
          cursor: "pointer", textAlign: "center",
        }}
      >
        + Add Budget Head
      </button>
    );
  }

  return (
    <div style={{
      background: "#F9F8FF", border: "1.5px solid #C7D2FE",
      borderRadius: 12, padding: "16px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#5B4FE9", marginBottom: 12 }}>
        New Budget Head
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Head Name *
          </label>
          <input
            value={headName}
            onChange={(e) => { setHeadName(e.target.value); setErrors((x) => ({ ...x, headName: undefined })); }}
            placeholder="e.g. Equipment, Travel, Consumables"
            style={{
              width: "100%", marginTop: 4, padding: "8px 12px",
              border: `1.5px solid ${errors.headName ? "#EF4444" : "#E5E7EB"}`,
              borderRadius: 8, fontSize: 13, color: "#1A1A2E",
              background: "white", boxSizing: "border-box", outline: "none",
            }}
          />
          {errors.headName && <p style={{ fontSize: 11, color: "#EF4444", marginTop: 3 }}>{errors.headName}</p>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "RECURRING" | "NON_RECURRING")}
              style={{
                width: "100%", marginTop: 4, padding: "8px 12px",
                border: "1.5px solid #E5E7EB", borderRadius: 8,
                fontSize: 13, background: "white", cursor: "pointer",
                boxSizing: "border-box", outline: "none",
              }}
            >
              <option value="RECURRING">Recurring</option>
              <option value="NON_RECURRING">Non-Recurring</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Allocated Amount (₹) *
            </label>
            <div style={{ position: "relative", marginTop: 4 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13 }}>₹</span>
              <input
                type="number"
                min={1}
                value={allocatedAmount}
                onChange={(e) => { setAllocatedAmount(e.target.value); setErrors((x) => ({ ...x, allocatedAmount: undefined })); }}
                placeholder="500000"
                style={{
                  width: "100%", padding: "8px 12px 8px 24px",
                  border: `1.5px solid ${errors.allocatedAmount ? "#EF4444" : "#E5E7EB"}`,
                  borderRadius: 8, fontSize: 13, color: "#1A1A2E",
                  background: "white", boxSizing: "border-box", outline: "none",
                }}
              />
            </div>
            {errors.allocatedAmount && <p style={{ fontSize: 11, color: "#EF4444", marginTop: 3 }}>{errors.allocatedAmount}</p>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={() => { setOpen(false); setErrors({}); setHeadName(""); setAllocatedAmount(""); }}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "white", fontSize: 13, fontWeight: 600, color: "#6B7280", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: "#5B4FE9", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer",
            }}
          >
            {loading ? "Saving…" : "Add Budget Head"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectTabs({
  project,
  userRole,
}: {
  project: Project;
  userRole: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const perms = can(userRole);

  function refresh() { router.refresh(); }

  const totalSpent = project.budgetHeads.reduce(
    (s, bh) => s + bh.expenditures.reduce((e, x) => e + x.amount, 0), 0
  );
  const budgetPct = project.totalBudget > 0
    ? Math.min(100, Math.round((totalSpent / project.totalBudget) * 100)) : 0;

  const visibleTabs: Tab[] = perms.viewFinancials
    ? ["overview", "milestones", "team", "financials", "documents", "messages"]
    : ["overview", "milestones", "team", "documents", "messages"];

  const counts: Partial<Record<Tab, number>> = {
    milestones: project.milestones.length,
    team: project.personnelRecords.length,
    documents: project.documents.length,
  };

  async function deleteMilestone(id: string) {
    if (!perms.deleteMilestone) return;
    if (!confirm("Delete this milestone?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/milestones?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Milestone deleted"); refresh(); }
    else toast.error("Failed to delete milestone");
  }

  async function deleteDocument(id: string) {
    if (!perms.deleteDocument) return;
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Document deleted"); refresh(); }
    else toast.error("Failed to delete document");
  }

  async function deleteExpenditure(id: string) {
    if (!perms.deleteExpenditure) return;
    if (!confirm("Delete this expenditure?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/expenditures?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Expenditure deleted"); refresh(); }
    else toast.error("Failed to delete expenditure");
  }

  async function deleteBudgetHead(id: string) {
    if (!perms.deleteBudgetHead) return;
    if (!confirm("Delete this budget head and all its expenditures?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/budget-heads?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Budget head deleted"); refresh(); }
    else toast.error("Failed to delete budget head");
  }

  async function deletePersonnel(id: string) {
    if (!perms.removeTeamMember) return;
    if (!confirm("Remove this team member?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/personnel?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Team member removed"); refresh(); }
    else toast.error("Failed to remove team member");
  }

  return (
    <div>
      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", gap: 4, borderBottom: "2px solid #EBEBF0",
        marginBottom: 24, overflowX: "auto",
      }}>
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 16px", fontSize: 13, fontWeight: 600,
              border: "none", background: "none", cursor: "pointer",
              whiteSpace: "nowrap",
              color: tab === t ? "#5B4FE9" : "#9999AA",
              borderBottom: tab === t ? "2px solid #5B4FE9" : "2px solid transparent",
              marginBottom: -2, transition: "all .15s",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {TAB_LABELS[t]}
            {counts[t] !== undefined && (
              <span style={{
                background: tab === t ? "#EEF2FF" : "#F5F5F7",
                color: tab === t ? "#5B4FE9" : "#9999AA",
                fontSize: 11, fontWeight: 700,
                padding: "1px 7px", borderRadius: 99,
              }}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {project.description && (
            <Card>
              <SectionLabel>About</SectionLabel>
              <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: 0 }}>
                {project.description}
              </p>
            </Card>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Grant Type", value: project.grantType, accent: true },
              { label: "Status", value: project.status, accent: true },
              { label: "Start Date", value: fmt(project.startDate) },
              { label: "End Date", value: fmt(project.endDate) },
              { label: "Total Budget", value: inr(project.totalBudget) },
              { label: "Sanction No.", value: project.sanctionNumber, mono: true },
            ].map((item) => (
              <div key={item.label} style={{
                background: item.accent ? "#EEF2FF" : "#FAFAFE",
                border: `1px solid ${item.accent ? "#C7D2FE" : "#EBEBF0"}`,
                borderRadius: 12, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: item.accent ? "#5B4FE9" : "#9999AA", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", fontFamily: item.mono ? "monospace" : undefined }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionLabel>Budget Utilisation</SectionLabel>
              <span style={{ fontSize: 13, fontWeight: 700, color: budgetPct > 90 ? "#C62828" : "#1A1A2E" }}>
                {budgetPct}%
              </span>
            </div>
            <ProgressBar value={budgetPct} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#9999AA" }}>
              <span>{inr(totalSpent)} spent</span>
              <span>{inr(project.totalBudget - totalSpent)} remaining</span>
            </div>
          </Card>
          <Card>
            <SectionLabel>Milestone Summary</SectionLabel>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              {(["COMPLETED","IN_PROGRESS","PENDING","DELAYED"] as const).map((s) => {
                const count = project.milestones.filter((m) => m.status === s).length;
                const cfg = MILESTONE_STATUS[s];
                return (
                  <div key={s} style={{
                    background: cfg.bg, color: cfg.color,
                    borderRadius: 10, padding: "10px 16px", textAlign: "center", minWidth: 80,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{count}</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Milestones ── */}
      {tab === "milestones" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#9999AA", fontWeight: 500 }}>
              {project.milestones.length} milestone{project.milestones.length !== 1 ? "s" : ""}
            </span>
            {perms.addMilestone && (
              <AddMilestoneForm projectId={project.id} onSuccess={refresh} />
            )}
          </div>
          {project.milestones.length === 0 ? (
            <Empty message="No milestones yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {project.milestones.map((m) => {
                const cfg = MILESTONE_STATUS[m.status] ?? MILESTONE_STATUS.PENDING;
                return (
                  <div key={m.id} style={{
                    background: "#fff", border: "1px solid #EBEBF0",
                    borderLeft: `4px solid ${cfg.color}`,
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E" }}>{m.title}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px",
                          borderRadius: 6, background: cfg.bg, color: cfg.color,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                      {m.description && (
                        <p style={{ fontSize: 12, color: "#9999AA", margin: "4px 0 0", lineHeight: 1.5 }}>
                          {m.description}
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: "#9999AA", margin: "6px 0 0" }}>
                        Due: {fmt(m.dueDate)}
                        {m.completedAt && (
                          <span style={{ color: "#2E7D32", marginLeft: 8 }}>
                            · Completed {fmt(m.completedAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {perms.updateMilestone && (
                        <MilestoneStatusButton milestoneId={m.id} currentStatus={m.status} onSuccess={refresh} />
                      )}
                      {perms.deleteMilestone && (
                        <button
                          onClick={() => deleteMilestone(m.id)}
                          disabled={deletingId === m.id}
                          style={{
                            background: "#FFF0F0", border: "none", borderRadius: 8,
                            color: "#C62828", fontSize: 12, fontWeight: 600,
                            padding: "5px 10px", cursor: "pointer",
                          }}
                        >
                          {deletingId === m.id ? "…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Team ── */}
      {tab === "team" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#9999AA", fontWeight: 500 }}>
              {project.personnelRecords.length} member{project.personnelRecords.length !== 1 ? "s" : ""}
            </span>
            {perms.addTeamMember && (
              <AddTeamMemberForm projectId={project.id} onSuccess={refresh} />
            )}
          </div>
          {project.personnelRecords.length === 0 ? (
            <Empty message="No team members yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {project.personnelRecords.map((pr, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <div key={pr.id} style={{
                    background: "#fff", border: "1px solid #EBEBF0", borderRadius: 12,
                    padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: color, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials(pr.user.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E" }}>{pr.user.name}</div>
                      <div style={{ fontSize: 12, color: "#9999AA" }}>{pr.user.email}</div>
                      {pr.joinDate && (
                        <div style={{ fontSize: 11, color: "#9999AA", marginTop: 2 }}>
                          Joined {fmt(pr.joinDate)}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        display: "inline-block", background: "#EEF2FF", color: "#5B4FE9",
                        fontSize: 11, fontWeight: 600, padding: "3px 10px",
                        borderRadius: 6, marginBottom: 4,
                      }}>
                        {ROLE_LABELS[pr.role] ?? pr.role}
                      </div>
                      {pr.stipend !== null && (
                        <div style={{ fontSize: 11, color: "#9999AA" }}>{inr(pr.stipend)}/mo</div>
                      )}
                    </div>
                    {perms.removeTeamMember && (
                      <button
                        onClick={() => deletePersonnel(pr.id)}
                        disabled={deletingId === pr.id}
                        style={{
                          background: "#FFF0F0", border: "none", borderRadius: 8,
                          color: "#C62828", fontSize: 12, fontWeight: 600,
                          padding: "5px 10px", cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        {deletingId === pr.id ? "…" : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {userRole !== "PI" && (
            <div style={{
              marginTop: 16, padding: "12px 16px",
              background: "#FFF8E1", borderRadius: 10,
              fontSize: 12, color: "#F57F17",
            }}>
              ℹ️ Only the Principal Investigator can add or remove team members.
            </div>
          )}
        </div>
      )}

      {/* ── Financials ── */}
      {tab === "financials" && perms.viewFinancials && (
        <div>
          {/* ── UPDATED HEADER: FinanceToolbar + AddExpenditureForm side by side ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#9999AA", fontWeight: 500 }}>
              Budget heads & expenditures
            </span>
            {perms.addExpenditure && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FinanceToolbar projectId={project.id} onImportSuccess={refresh} />
                {project.budgetHeads.length > 0 && (
                  <AddExpenditureForm
                    projectId={project.id}
                    budgetHeads={project.budgetHeads}
                    onSuccess={refresh}
                  />
                )}
              </div>
            )}
          </div>

          {!perms.addExpenditure && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "#EEF2FF", borderRadius: 10,
              fontSize: 12, color: "#5B4FE9",
            }}>
              ℹ️ You can view financials but only the PI can add or delete expenditures.
            </div>
          )}

          {project.budgetHeads.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
              {project.budgetHeads.map((bh) => {
                const spent = bh.expenditures.reduce((s, e) => s + e.amount, 0);
                const pct = bh.allocatedAmount > 0
                  ? Math.min(100, Math.round((spent / bh.allocatedAmount) * 100)) : 0;
                const over = spent > bh.allocatedAmount;
                return (
                  <div key={bh.id} style={{
                    background: "#fff", border: `1px solid ${over ? "#FFCDD2" : "#EBEBF0"}`,
                    borderRadius: 12, overflow: "hidden",
                  }}>
                    <div style={{
                      background: over ? "#FFF5F5" : "#FAFAFE",
                      padding: "14px 16px", borderBottom: "1px solid #EBEBF0",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E" }}>{bh.name}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            background: bh.category === "NON_RECURRING" ? "#F3E5F5" : "#E8F5E9",
                            color: bh.category === "NON_RECURRING" ? "#7B1FA2" : "#2E7D32",
                            padding: "2px 8px", borderRadius: 4,
                          }}>
                            {bh.category === "NON_RECURRING" ? "Non-Recurring" : "Recurring"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: over ? "#C62828" : "#1A1A2E" }}>
                            {inr(spent)} / {inr(bh.allocatedAmount)}
                          </span>
                          {perms.deleteBudgetHead && (
                            <button
                              onClick={() => deleteBudgetHead(bh.id)}
                              disabled={deletingId === bh.id}
                              style={{
                                background: "#FFF0F0", border: "none", borderRadius: 6,
                                color: "#C62828", fontSize: 11, fontWeight: 600,
                                padding: "3px 8px", cursor: "pointer",
                              }}
                            >
                              {deletingId === bh.id ? "…" : "Delete"}
                            </button>
                          )}
                        </div>
                      </div>
                      <ProgressBar value={pct} danger={over} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#9999AA" }}>
                        <span>{pct}% used</span>
                        <span style={{ color: over ? "#C62828" : "#9999AA" }}>
                          {over
                            ? `₹${(spent - bh.allocatedAmount).toLocaleString("en-IN")} over budget`
                            : `${inr(bh.allocatedAmount - spent)} remaining`}
                        </span>
                      </div>
                    </div>
                    {bh.expenditures.length > 0 ? (
                      <div style={{ padding: "0 16px" }}>
                        {bh.expenditures.map((exp, i) => (
                          <div key={exp.id} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 0",
                            borderBottom: i < bh.expenditures.length - 1 ? "1px solid #F5F5F7" : "none",
                          }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 8,
                              background: "#EEF2FF", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 16,
                            }}>💸</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                                {exp.description}
                              </div>
                              <div style={{ fontSize: 11, color: "#9999AA", marginTop: 2 }}>
                                {fmt(exp.date)}
                                {exp.invoiceNumber && ` · ${exp.invoiceNumber}`}
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", flexShrink: 0 }}>
                              {inr(exp.amount)}
                            </div>
                            {perms.deleteExpenditure && (
                              <button
                                onClick={() => deleteExpenditure(exp.id)}
                                disabled={deletingId === exp.id}
                                style={{
                                  background: "#FFF0F0", border: "none", borderRadius: 6,
                                  color: "#C62828", fontSize: 11, fontWeight: 600,
                                  padding: "4px 8px", cursor: "pointer", flexShrink: 0,
                                }}
                              >
                                {deletingId === exp.id ? "…" : "Delete"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "#9999AA", padding: "12px 16px", margin: 0 }}>
                        No expenditures recorded yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {perms.addBudgetHead && (
            <AddBudgetHeadInline projectId={project.id} onSuccess={refresh} />
          )}

          {project.budgetHeads.length === 0 && !perms.addBudgetHead && (
            <Empty message="No budget heads defined for this project yet." />
          )}

          {project.budgetHeads.length > 0 && (
            <div style={{
              marginTop: 16, background: "linear-gradient(135deg, #5B4FE9, #7C6FF7)",
              borderRadius: 12, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              color: "#fff",
            }}>
              <span style={{ fontSize: 13, opacity: .85 }}>Total Spent</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{inr(totalSpent)}</div>
                <div style={{ fontSize: 11, opacity: .75 }}>
                  of {inr(project.totalBudget)} · {budgetPct}% used
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {tab === "documents" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#9999AA", fontWeight: 500 }}>
              {project.documents.length} document{project.documents.length !== 1 ? "s" : ""}
            </span>
            {perms.uploadDocument && (
              <UploadDocumentForm projectId={project.id} onSuccess={refresh} />
            )}
          </div>
          {project.documents.length === 0 ? (
            <Empty message="No documents uploaded yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {project.documents.map((doc) => (
                <div key={doc.id} style={{
                  background: "#fff", border: "1px solid #EBEBF0", borderRadius: 12,
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, background: "#EEF2FF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>📋</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9999AA", marginTop: 2 }}>
                      {doc.type} · {fmt(doc.uploadedAt)}
                    </div>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: "#EEF2FF", color: "#5B4FE9", fontSize: 12,
                      fontWeight: 600, padding: "5px 12px", borderRadius: 7,
                      textDecoration: "none", flexShrink: 0,
                    }}
                  >
                    View →
                  </a>
                  {perms.deleteDocument && (
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      disabled={deletingId === doc.id}
                      style={{
                        background: "#FFF0F0", border: "none", borderRadius: 7,
                        color: "#C62828", fontSize: 12, fontWeight: 600,
                        padding: "5px 10px", cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      {deletingId === doc.id ? "…" : "Delete"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      {tab === "messages" && (
        <MessagingTab projectId={project.id} />
      )}
    </div>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#FAFAFE", border: "1px solid #EBEBF0", borderRadius: 12, padding: "16px 18px" }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#9999AA", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function ProgressBar({ value, danger = false }: { value: number; danger?: boolean }) {
  return (
    <div style={{ height: 6, borderRadius: 99, background: "#EBEBF0", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${value}%`, borderRadius: 99,
        background: danger
          ? "linear-gradient(90deg,#EF5350,#E53935)"
          : value > 80
          ? "linear-gradient(90deg,#FFA726,#FB8C00)"
          : "linear-gradient(90deg,#5B4FE9,#7C6FF7)",
        transition: "width .4s ease",
      }} />
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{
      border: "2px dashed #EBEBF0", borderRadius: 12,
      padding: "40px 24px", textAlign: "center",
      color: "#9999AA", fontSize: 13,
    }}>
      {message}
    </div>
  );
}