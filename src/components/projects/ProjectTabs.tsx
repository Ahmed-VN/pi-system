"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AddMilestoneForm from "./AddMilestoneForm";
import MilestoneStatusButton from "./MilestoneStatusButton";
import AddTeamMemberForm from "./AddTeamMemberForm";
import AddExpenditureForm from "./AddExpenditureForm";
import UploadDocumentForm from "./UploadDocumentForm";

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
    uploadDocument:    role === "PI" || role === "CO_PI",
    deleteDocument:    role === "PI",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
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

type Tab = "overview" | "milestones" | "team" | "financials" | "documents";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  milestones: "Milestones",
  team: "Team",
  financials: "Financials",
  documents: "Documents",
};

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
    ? ["overview", "milestones", "team", "financials", "documents"]
    : ["overview", "milestones", "team", "documents"];

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

  async function deleteExpenditure(id: string) {
    if (!perms.deleteExpenditure) return;
    if (!confirm("Delete this expenditure?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/expenditures?id=${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Expenditure deleted"); refresh(); }
    else toast.error("Failed to delete expenditure");
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
                        <MilestoneStatusButton
                          milestoneId={m.id}
                          currentStatus={m.status}
                          onSuccess={refresh}
                        />
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

      {/* ── Financials (PI and Co-PI only) ── */}
      {tab === "financials" && perms.viewFinancials && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#9999AA", fontWeight: 500 }}>
              Budget heads & expenditures
            </span>
            {perms.addExpenditure && (
              <AddExpenditureForm
                projectId={project.id}
                budgetHeads={project.budgetHeads}
                onSuccess={refresh}
              />
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
          {project.budgetHeads.length === 0 ? (
            <Empty message="No budget heads defined for this project." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E" }}>{bh.name}</span>
                          <span style={{
                            marginLeft: 8, fontSize: 11, fontWeight: 600,
                            background: bh.category === "NON_RECURRING" ? "#F3E5F5" : "#E8F5E9",
                            color: bh.category === "NON_RECURRING" ? "#7B1FA2" : "#2E7D32",
                            padding: "2px 8px", borderRadius: 4,
                          }}>
                            {bh.category === "NON_RECURRING" ? "Non-Recurring" : "Recurring"}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: over ? "#C62828" : "#1A1A2E" }}>
                          {inr(spent)} / {inr(bh.allocatedAmount)}
                        </span>
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
                    {bh.expenditures.length > 0 && (
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
                    )}
                    {bh.expenditures.length === 0 && (
                      <p style={{ fontSize: 12, color: "#9999AA", padding: "12px 16px", margin: 0 }}>
                        No expenditures recorded yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
          {userRole === "JRF" && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "#FFF8E1", borderRadius: 10,
              fontSize: 12, color: "#F57F17",
            }}>
              ℹ️ You can view documents. Only PI and Co-PI can upload documents.
            </div>
          )}
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
                </div>
              ))}
            </div>
          )}
        </div>
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