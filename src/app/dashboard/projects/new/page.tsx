"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


type GrantType = "ARG" | "IRG" | "PM_ECRG";

const GRANT_LABELS: Record<GrantType, { label: string; desc: string }> = {
  ARG: {
    label: "ARG",
    desc: "Anusandhan Research Grant",
  },
  IRG: {
    label: "IRG",
    desc: "Institutional Research Grant",
  },
  PM_ECRG: {
    label: "PM-ECRG",
    desc: "PM Early Career Research Grant",
  },
};

export default function NewProjectPage() {
  const router = useRouter();
 

  const [form, setForm] = useState({
    title: "",
    grantType: "" as GrantType | "",
    sanctionNumber: "",
    startDate: "",
    endDate: "",
    hostInstitution: "",
    totalBudget: "",
    abstractText: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  function selectGrant(type: GrantType) {
    setForm((prev) => ({ ...prev, grantType: type }));
    setError(null);
  }

  function validateStep1() {
    if (!form.title.trim()) return "Project title is required.";
    if (!form.grantType) return "Please select a grant type.";
    if (!form.sanctionNumber.trim()) return "Sanction number is required.";
    if (!form.hostInstitution.trim()) return "Host institution is required.";
    return null;
  }

  function validateStep2() {
    if (!form.startDate) return "Start date is required.";
    if (!form.endDate) return "End date is required.";
    if (form.startDate >= form.endDate)
      return "End date must be after start date.";
    const budget = parseFloat(form.totalBudget);
    if (!form.totalBudget || isNaN(budget) || budget <= 0)
      return "Enter a valid budget amount (in ₹).";
    return null;
  }

  function goToStep2() {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          grantType: form.grantType,
          sanctionNumber: form.sanctionNumber.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          hostInstitution: form.hostInstitution.trim(),
          totalBudget: parseFloat(form.totalBudget),
          abstractText: form.abstractText.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create project. Please try again.");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/projects/${data.id}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.gridBg} aria-hidden />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button
            onClick={() => (step === 2 ? setStep(1) : router.back())}
            style={styles.backBtn}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ marginRight: 6 }}
            >
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {step === 2 ? "Back" : "Projects"}
          </button>

          <div style={styles.stepIndicator}>
            <div style={styles.stepDot(step >= 1)}>1</div>
            <div style={styles.stepLine(step === 2)} />
            <div style={styles.stepDot(step === 2)}>2</div>
          </div>
        </div>

        {/* Card */}
        <div style={styles.card}>
          {/* Left accent */}
          <div style={styles.cardAccent} />

          <div style={styles.cardInner}>
            {/* Title row */}
            <div style={styles.titleRow}>
              <div>
                <div style={styles.stepLabel}>
                  Step {step} of 2 —{" "}
                  {step === 1 ? "Project Identity" : "Timeline & Budget"}
                </div>
                <h1 style={styles.pageTitle}>
                  {step === 1 ? "New ANRF Project" : "Dates & Funding"}
                </h1>
              </div>
              <div style={styles.anrfBadge}>ANRF</div>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5" />
                  <path
                    d="M8 5v3.5M8 10.5v.5"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {step === 1 ? (
                <div style={styles.fields}>
                  {/* Grant Type */}
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Grant Type *</label>
                    <div style={styles.grantGrid}>
                      {(Object.keys(GRANT_LABELS) as GrantType[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => selectGrant(g)}
                          style={styles.grantCard(form.grantType === g)}
                        >
                          <div style={styles.grantCardLabel(form.grantType === g)}>
                            {GRANT_LABELS[g].label}
                          </div>
                          <div style={styles.grantCardDesc}>
                            {GRANT_LABELS[g].desc}
                          </div>
                          {form.grantType === g && (
                            <div style={styles.grantCheck}>✓</div>
                          )}
                        </button>
                      ))}
                    </div>
                    {form.grantType === "ARG" && (
                      <div style={styles.ruleNote}>
                        ⚠ Maximum 4 ARG projects allowed per PI
                      </div>
                    )}
                  </div>

                  {/* Project Title */}
                  <div style={styles.fieldGroup}>
                    <label htmlFor="title" style={styles.label}>
                      Project Title *
                    </label>
                    <input
                      id="title"
                      name="title"
                      type="text"
                      value={form.title}
                      onChange={handleChange}
                      placeholder="Full title as approved in sanction letter"
                      style={styles.input}
                      autoComplete="off"
                    />
                  </div>

                  {/* Two columns: Sanction + Institution */}
                  <div style={styles.twoCol}>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="sanctionNumber" style={styles.label}>
                        Sanction Number *
                      </label>
                      <input
                        id="sanctionNumber"
                        name="sanctionNumber"
                        type="text"
                        value={form.sanctionNumber}
                        onChange={handleChange}
                        placeholder="e.g. ANRF/2024/ARG/001"
                        style={styles.input}
                        autoComplete="off"
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="hostInstitution" style={styles.label}>
                        Host Institution *
                      </label>
                      <input
                        id="hostInstitution"
                        name="hostInstitution"
                        type="text"
                        value={form.hostInstitution}
                        onChange={handleChange}
                        placeholder="e.g. IIT Delhi"
                        style={styles.input}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Abstract */}
                  <div style={styles.fieldGroup}>
                    <label htmlFor="abstractText" style={styles.label}>
                      Project Abstract
                      <span style={styles.optional}> (optional)</span>
                    </label>
                    <textarea
                      id="abstractText"
                      name="abstractText"
                      value={form.abstractText}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Brief description of the research objectives and methodology…"
                      style={styles.textarea}
                    />
                  </div>

                  <button type="button" onClick={goToStep2} style={styles.nextBtn}>
                    Continue to Timeline & Budget
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      style={{ marginLeft: 8 }}
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div style={styles.fields}>
                  {/* Dates */}
                  <div style={styles.twoCol}>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="startDate" style={styles.label}>
                        Start Date *
                      </label>
                      <input
                        id="startDate"
                        name="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.fieldGroup}>
                      <label htmlFor="endDate" style={styles.label}>
                        End Date *
                      </label>
                      <input
                        id="endDate"
                        name="endDate"
                        type="date"
                        value={form.endDate}
                        onChange={handleChange}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  {/* Budget */}
                  <div style={styles.fieldGroup}>
                    <label htmlFor="totalBudget" style={styles.label}>
                      Total Sanctioned Budget (₹) *
                    </label>
                    <div style={styles.budgetInputWrap}>
                      <span style={styles.budgetPrefix}>₹</span>
                      <input
                        id="totalBudget"
                        name="totalBudget"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.totalBudget}
                        onChange={handleChange}
                        placeholder="0.00"
                        style={styles.budgetInput}
                      />
                    </div>
                    {form.totalBudget &&
                      !isNaN(parseFloat(form.totalBudget)) && (
                        <div style={styles.budgetPreview}>
                          ≈{" "}
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(parseFloat(form.totalBudget))}
                        </div>
                      )}
                  </div>

                  {/* Info box */}
                  <div style={styles.infoBox}>
                    <div style={styles.infoTitle}>ANRF Limits</div>
                    <ul style={styles.infoList}>
                      <li>Maximum 8 simultaneous ACTIVE / EXTENDED projects</li>
                      <li>Maximum 4 ARG projects per PI</li>
                      <li>
                        New project status will be set to{" "}
                        <strong>PENDING</strong> until activated
                      </li>
                    </ul>
                  </div>

                  {/* Review summary */}
                  <div style={styles.reviewBox}>
                    <div style={styles.reviewTitle}>Review</div>
                    <div style={styles.reviewGrid}>
                      <div style={styles.reviewRow}>
                        <span style={styles.reviewKey}>Grant Type</span>
                        <span style={styles.reviewVal}>
                          {form.grantType
                            ? GRANT_LABELS[form.grantType as GrantType].label
                            : "—"}
                        </span>
                      </div>
                      <div style={styles.reviewRow}>
                        <span style={styles.reviewKey}>Sanction No.</span>
                        <span style={styles.reviewVal}>
                          {form.sanctionNumber || "—"}
                        </span>
                      </div>
                      <div style={styles.reviewRow}>
                        <span style={styles.reviewKey}>Institution</span>
                        <span style={styles.reviewVal}>
                          {form.hostInstitution || "—"}
                        </span>
                      </div>
                    </div>
                    <div style={styles.reviewProjectTitle}>{form.title}</div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={styles.submitBtn(loading)}
                  >
                    {loading ? (
                      <>
                        <span style={styles.spinner} />
                        Creating project…
                      </>
                    ) : (
                      <>
                        Create Project
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ marginLeft: 8 }}
                        >
                          <path
                            d="M8 3v10M3 8h10"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const PURPLE = "#5B4FE9";
const DARK = "#1A1A2E";
const BG = "#F5F5F7";
const BORDER = "#EBEBF0";

const styles = {
  page: {
    minHeight: "100vh",
    background: BG,
    position: "relative" as const,
    padding: "32px 24px 64px",
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gridBg: {
    position: "fixed" as const,
    inset: 0,
    backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`,
    backgroundSize: "40px 40px",
    opacity: 0.5,
    pointerEvents: "none" as const,
    zIndex: 0,
  },
  container: {
    maxWidth: 680,
    margin: "0 auto",
    position: "relative" as const,
    zIndex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6B7280",
    fontSize: 13,
    fontWeight: 500,
    padding: "6px 0",
    transition: "color 0.15s",
  },
  stepIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 0,
  },
  stepDot: (active: boolean) => ({
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: active ? PURPLE : "#E5E7EB",
    color: active ? "#fff" : "#9CA3AF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.2s",
  }),
  stepLine: (active: boolean) => ({
    width: 40,
    height: 2,
    background: active ? PURPLE : "#E5E7EB",
    transition: "background 0.2s",
  }),
  card: {
    background: "#fff",
    borderRadius: 16,
    border: `1px solid ${BORDER}`,
    boxShadow: "0 4px 24px rgba(91,79,233,0.06), 0 1px 4px rgba(0,0,0,0.04)",
    overflow: "hidden",
    position: "relative" as const,
  },
  cardAccent: {
    height: 4,
    background: `linear-gradient(90deg, ${PURPLE}, #8B7CF6)`,
  },
  cardInner: {
    padding: "32px 36px 36px",
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: PURPLE,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: DARK,
    margin: 0,
    letterSpacing: "-0.3px",
  },
  anrfBadge: {
    background: DARK,
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    padding: "5px 10px",
    borderRadius: 6,
    marginTop: 4,
  },
  errorBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#B91C1C",
    marginBottom: 20,
  },
  fields: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  },
  optional: {
    fontWeight: 400,
    color: "#9CA3AF",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    color: DARK,
    background: "#FAFAFA",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    fontSize: 14,
    color: DARK,
    background: "#FAFAFA",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: 1.6,
    boxSizing: "border-box" as const,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  grantGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  grantCard: (selected: boolean) => ({
    position: "relative" as const,
    padding: "14px 14px 12px",
    border: `2px solid ${selected ? PURPLE : BORDER}`,
    borderRadius: 10,
    background: selected ? "#F3F1FF" : "#FAFAFA",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.15s",
  }),
  grantCardLabel: (selected: boolean) => ({
    fontSize: 14,
    fontWeight: 700,
    color: selected ? PURPLE : DARK,
    marginBottom: 3,
  }),
  grantCardDesc: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 1.4,
  },
  grantCheck: {
    position: "absolute" as const,
    top: 8,
    right: 10,
    fontSize: 11,
    fontWeight: 700,
    color: PURPLE,
  },
  ruleNote: {
    fontSize: 12,
    color: "#D97706",
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 6,
    padding: "7px 10px",
  },
  budgetInputWrap: {
    display: "flex",
    alignItems: "center",
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    background: "#FAFAFA",
    overflow: "hidden",
  },
  budgetPrefix: {
    padding: "10px 12px",
    background: "#F3F4F6",
    borderRight: `1px solid ${BORDER}`,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: 600,
  },
  budgetInput: {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "10px 14px",
    fontSize: 14,
    color: DARK,
    background: "transparent",
  },
  budgetPreview: {
    fontSize: 12,
    color: PURPLE,
    fontWeight: 600,
    marginTop: 4,
  },
  infoBox: {
    background: "#F0F4FF",
    border: "1px solid #C7D4F8",
    borderRadius: 10,
    padding: "14px 16px",
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#3B5BDB",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  infoList: {
    margin: 0,
    padding: "0 0 0 16px",
    fontSize: 12,
    color: "#374151",
    lineHeight: 1.7,
  },
  reviewBox: {
    background: DARK,
    borderRadius: 10,
    padding: "16px 18px",
  },
  reviewTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    marginBottom: 12,
  },
  reviewGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    marginBottom: 12,
  },
  reviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewKey: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },
  reviewVal: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
  },
  reviewProjectTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    paddingTop: 12,
    lineHeight: 1.5,
  },
  nextBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: DARK,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s",
    marginTop: 4,
  },
  submitBtn: (loading: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: loading
      ? "#9CA3AF"
      : `linear-gradient(135deg, ${PURPLE}, #8B7CF6)`,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
    marginTop: 4,
    boxShadow: loading ? "none" : "0 4px 12px rgba(91,79,233,0.35)",
  }),
  spinner: {
    width: 14,
    height: 14,
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
    marginRight: 8,
  },
};