"use client";

import { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Member {
  id: string;
  role: string;
  joinDate: string;
  endDate: string | null;
  stipend: number;
  user: {
    id: string;
    name: string;
    email: string;
    designation: string | null;
    institution: string | null;
    phone: string | null;
  };
  project: {
    id: string;
    title: string;
    shortTitle: string | null;
    sanctionNumber: string;
    status: string;
  };
}

interface GroupedMember {
  user: Member["user"];
  entries: Array<{
    id: string;
    role: string;
    joinDate: string;
    endDate: string | null;
    stipend: number;
    project: Member["project"];
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  PI:     { bg: "#EDE9FE", text: "#5B21B6", dot: "#7C3AED" },
  CO_PI:  { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  JRF:    { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  ADMIN:  { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
};
const roleStyle = (role: string) =>
  ROLE_COLOR[role] ?? { bg: "#F3F4F6", text: "#374151", dot: "#6B7280" };

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:   "#10B981",
  PENDING:  "#F59E0B",
  EXTENDED: "#3B82F6",
  CLOSED:   "#6B7280",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const AVATAR_PALETTE = [
  "#5B4FE9","#7C3AED","#DB2777","#D97706","#059669",
  "#2563EB","#DC2626","#0891B2","#65A30D","#9333EA",
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ── Component ──────────────────────────────────────────────────────────────
export default function TeamPage() {

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // fetch all personnel across all projects
  useEffect(() => {
    (async () => {
      try {
        // Get all projects first
        const projRes = await fetch("/api/projects");
        const projData = await projRes.json();
        const projects: { id: string }[] = projData.projects ?? projData ?? [];

        // Fetch personnel for each project
        const allMembers: Member[] = [];
        await Promise.all(
          projects.map(async (p) => {
            const res = await fetch(`/api/personnel?projectId=${p.id}`);
            const data = await res.json();
            const list: Member[] = (data.personnel ?? data ?? []).map(
              (m: any) => ({ ...m, project: projects.find((x) => x.id === p.id) ?? p })
            );
            allMembers.push(...list);
          })
        );

        // Re-fetch projects with full info for project metadata
        const fullProjRes = await fetch("/api/projects");
        const fullProjData = await fullProjRes.json();
        const fullProjects: Member["project"][] = (
          fullProjData.projects ?? fullProjData ?? []
        ).map((p: any) => ({
          id: p.id,
          title: p.title,
          shortTitle: p.shortTitle ?? null,
          sanctionNumber: p.sanctionNumber,
          status: p.status,
        }));

        const enriched = allMembers.map((m) => ({
          ...m,
          project: fullProjects.find((p) => p.id === m.project.id) ?? m.project,
        }));

        setMembers(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group by user
  const grouped: GroupedMember[] = [];
  const seen = new Map<string, number>();
  for (const m of members) {
    if (!seen.has(m.user.id)) {
      seen.set(m.user.id, grouped.length);
      grouped.push({ user: m.user, entries: [] });
    }
    grouped[seen.get(m.user.id)!].entries.push({
      id: m.id,
      role: m.role,
      joinDate: m.joinDate,
      endDate: m.endDate,
      stipend: m.stipend,
      project: m.project,
    });
  }

  // Filter
  const filtered = grouped.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      g.user.name.toLowerCase().includes(q) ||
      g.user.email.toLowerCase().includes(q) ||
      g.entries.some(
        (e) =>
          e.role.toLowerCase().includes(q) ||
          e.project.title.toLowerCase().includes(q)
      );
    const matchRole =
      roleFilter === "ALL" || g.entries.some((e) => e.role === roleFilter);
    return matchSearch && matchRole;
  });

  // Stats
  const totalUnique = grouped.length;
  const byRole = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
  const activeCount = members.filter(
    (m) => m.project.status === "ACTIVE"
  ).length;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F5F5F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "3px solid #E5E7EB",
              borderTop: "3px solid #5B4FE9",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Loading team data…</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F5F7",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "#1A1A2E",
      }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card-anim { animation: fadeUp 0.35s ease both; }
        .member-card:hover { box-shadow: 0 8px 32px rgba(91,79,233,0.13); transform: translateY(-2px); }
        .member-card { transition: box-shadow 0.2s, transform 0.2s; }
        .tag { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
        .pill { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; }
        input:focus { outline: none; border-color: #5B4FE9 !important; box-shadow: 0 0 0 3px rgba(91,79,233,0.12); }
        .toggle-btn { border: none; cursor: pointer; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; transition: background 0.15s, color 0.15s; }
        .filter-btn { border: 1.5px solid #EBEBF0; background: white; cursor: pointer; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; transition: all 0.15s; }
        .filter-btn.active { background: #5B4FE9; color: white; border-color: #5B4FE9; }
        tr:hover td { background: #F9F8FF; }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #EBEBF0",
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#1A1A2E" }}>
            Team Members
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            All personnel across your ANRF research projects
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="toggle-btn"
            onClick={() => setView("cards")}
            style={{
              background: view === "cards" ? "#5B4FE9" : "#F3F4F6",
              color: view === "cards" ? "white" : "#374151",
            }}
          >
            ⊞ Cards
          </button>
          <button
            className="toggle-btn"
            onClick={() => setView("table")}
            style={{
              background: view === "table" ? "#5B4FE9" : "#F3F4F6",
              color: view === "table" ? "white" : "#374151",
            }}
          >
            ☰ Table
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px" }}>

        {/* ── Stats row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Total Members", value: totalUnique, color: "#5B4FE9", icon: "👥" },
            { label: "In Active Projects", value: new Set(members.filter(m => m.project.status === "ACTIVE").map(m => m.user.id)).size, color: "#10B981", icon: "✅" },
            { label: "PI / Co-PIs", value: (byRole["PI"] ?? 0) + (byRole["CO_PI"] ?? 0), color: "#7C3AED", icon: "🎓" },
            { label: "JRF / Fellows", value: byRole["JRF"] ?? 0, color: "#F59E0B", icon: "🔬" },
          ].map((s, i) => (
            <div
              key={i}
              className="card-anim"
              style={{
                background: "white",
                borderRadius: 14,
                padding: "20px 22px",
                border: "1px solid #EBEBF0",
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9CA3AF",
                fontSize: 15,
              }}
            >
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, role…"
              style={{
                width: "100%",
                padding: "9px 12px 9px 36px",
                border: "1.5px solid #EBEBF0",
                borderRadius: 10,
                fontSize: 13,
                background: "white",
                color: "#1A1A2E",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Role pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["ALL", "PI", "CO_PI", "JRF"].map((r) => (
              <button
                key={r}
                className={`filter-btn ${roleFilter === r ? "active" : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r === "ALL" ? "All Roles" : r.replace("_", "-")}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", fontSize: 13, color: "#6B7280" }}>
            {filtered.length} of {grouped.length} members
          </div>
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 0",
              color: "#9CA3AF",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>No members found</p>
            <p style={{ fontSize: 13 }}>Try adjusting your search or filter</p>
          </div>
        )}

        {/* ── CARD VIEW ── */}
        {view === "cards" && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 18,
            }}
          >
            {filtered.map((g, i) => {
              const isExpanded = expandedUser === g.user.id;
              const primaryEntry = g.entries[0];
              const rs = roleStyle(primaryEntry.role);
              const bg = avatarColor(g.user.name);
              const isActive = g.entries.some(
                (e) => e.project.status === "ACTIVE"
              );

              return (
                <div
                  key={g.user.id}
                  className="member-card card-anim"
                  style={{
                    background: "white",
                    borderRadius: 16,
                    border: "1px solid #EBEBF0",
                    overflow: "hidden",
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {/* Card top strip */}
                  <div
                    style={{
                      height: 6,
                      background: `linear-gradient(90deg, ${bg}, ${bg}88)`,
                    }}
                  />

                  <div style={{ padding: "20px 22px 0" }}>
                    {/* Avatar + name row */}
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          background: bg,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          fontWeight: 800,
                          flexShrink: 0,
                          letterSpacing: "-0.5px",
                        }}
                      >
                        {initials(g.user.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#1A1A2E",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {g.user.name}
                        </div>
                        {g.user.designation && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6B7280",
                              marginTop: 2,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {g.user.designation}
                          </div>
                        )}
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span
                            className="tag"
                            style={{ background: rs.bg, color: rs.text }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: rs.dot,
                                display: "inline-block",
                              }}
                            />
                            {primaryEntry.role.replace("_", "-")}
                          </span>
                          {isActive && (
                            <span
                              className="tag"
                              style={{ background: "#D1FAE5", color: "#065F46" }}
                            >
                              ● Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 8, alignItems: "center" }}>
                        <span>✉️</span>
                        <a
                          href={`mailto:${g.user.email}`}
                          style={{ color: "#5B4FE9", textDecoration: "none", fontWeight: 500 }}
                        >
                          {g.user.email}
                        </a>
                      </div>
                      {g.user.institution && (
                        <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 8, alignItems: "center" }}>
                          <span>🏛️</span>
                          <span style={{ fontWeight: 500, color: "#374151" }}>{g.user.institution}</span>
                        </div>
                      )}
                      {g.user.phone && (
                        <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 8, alignItems: "center" }}>
                          <span>📞</span>
                          <span style={{ color: "#374151" }}>{g.user.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Project badge(s) */}
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {g.entries.length === 1 ? "Project" : `${g.entries.length} Projects`}
                      </div>
                      {(isExpanded ? g.entries : g.entries.slice(0, 1)).map((e) => (
                        <div
                          key={e.id}
                          style={{
                            background: "#F9F8FF",
                            border: "1px solid #EDE9FE",
                            borderRadius: 10,
                            padding: "10px 12px",
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#1A1A2E",
                                flex: 1,
                                lineHeight: 1.4,
                              }}
                            >
                              {e.project.shortTitle ?? e.project.title}
                            </div>
                            <span
                              className="pill"
                              style={{
                                background: `${STATUS_COLOR[e.project.status] ?? "#6B7280"}18`,
                                color: STATUS_COLOR[e.project.status] ?? "#6B7280",
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: STATUS_COLOR[e.project.status] ?? "#6B7280",
                                  display: "inline-block",
                                }}
                              />
                              {e.project.status}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, display: "flex", gap: 12 }}>
                            <span style={{ fontSize: 11, color: "#6B7280" }}>
                              From {fmt(e.joinDate)}
                            </span>
                            {e.stipend > 0 && (
                              <span style={{ fontSize: 11, color: "#6B7280" }}>
                                ₹{e.stipend.toLocaleString("en-IN")}/mo
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {g.entries.length > 1 && (
                        <button
                          onClick={() =>
                            setExpandedUser(isExpanded ? null : g.user.id)
                          }
                          style={{
                            background: "none",
                            border: "none",
                            color: "#5B4FE9",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "2px 0",
                          }}
                        >
                          {isExpanded
                            ? "▲ Show less"
                            : `▼ +${g.entries.length - 1} more project${g.entries.length > 2 ? "s" : ""}`}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      margin: "16px 0 0",
                      padding: "12px 22px",
                      borderTop: "1px solid #F3F4F6",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      Joined {fmt(primaryEntry.joinDate)}
                    </span>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {view === "table" && filtered.length > 0 && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              border: "1px solid #EBEBF0",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9F8FF", borderBottom: "1px solid #EBEBF0" }}>
                  {["Member", "Role", "Institution", "Project", "Joined", "Stipend / mo"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "13px 18px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#6B7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.flatMap((g) =>
                  g.entries.map((e, ei) => {
                    const rs = roleStyle(e.role);
                    const bg = avatarColor(g.user.name);
                    return (
                      <tr
                        key={e.id}
                        style={{ borderBottom: "1px solid #F3F4F6" }}
                      >
                        {/* Member cell — only show on first entry */}
                        <td style={{ padding: "13px 18px" }}>
                          {ei === 0 ? (
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  background: bg,
                                  color: "white",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {initials(g.user.name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "#1A1A2E" }}>{g.user.name}</div>
                                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{g.user.email}</div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#D1D5DB", paddingLeft: 44, fontSize: 11 }}>↳</span>
                          )}
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <span
                            className="tag"
                            style={{ background: rs.bg, color: rs.text }}
                          >
                            {e.role.replace("_", "-")}
                          </span>
                        </td>
                        <td style={{ padding: "13px 18px", color: "#6B7280", fontSize: 12 }}>
                          {g.user.institution ?? "—"}
                        </td>
                        <td style={{ padding: "13px 18px", maxWidth: 220 }}>
                          <div style={{ fontWeight: 500, color: "#1A1A2E", fontSize: 12, lineHeight: 1.4 }}>
                            {e.project.shortTitle ?? e.project.title}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                            <span
                              className="pill"
                              style={{
                                background: `${STATUS_COLOR[e.project.status] ?? "#6B7280"}18`,
                                color: STATUS_COLOR[e.project.status] ?? "#6B7280",
                              }}
                            >
                              {e.project.status}
                            </span>
                            <span style={{ fontSize: 10, color: "#9CA3AF" }}>
                              {e.project.sanctionNumber}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", color: "#6B7280", fontSize: 12 }}>
                          {fmt(e.joinDate)}
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          {e.stipend > 0 ? (
                            <span style={{ fontWeight: 600, color: "#1A1A2E" }}>
                              ₹{e.stipend.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span style={{ color: "#D1D5DB" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}