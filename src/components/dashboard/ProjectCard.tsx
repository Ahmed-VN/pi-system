"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  title: string;
  sanctionNumber: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  pi: { name: string; email: string } | null;
  budgetHeads: {
    allocatedAmount: number;
    expenditures: { amount: number }[];
  }[];
  milestones: { status: string }[];
  personnelRecords: { id: string }[];
};

function getStatusStyle(status: string) {
  if (status === "ACTIVE") return { label: "Active", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
  if (status === "PENDING") return { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" };
  if (status === "EXTENDED") return { label: "Extended", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" };
  return { label: "Closed", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" };
}

export default function ProjectCard({
  project,
  isPI = false,
}: {
  project: Project;
  isPI?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalBudget = project.budgetHeads.reduce((s, b) => s + b.allocatedAmount, 0);
  const totalSpent = project.budgetHeads.reduce((s, b) => s + b.expenditures.reduce((e, x) => e + x.amount, 0), 0);
  const spentPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const doneMilestones = project.milestones.filter((m) => m.status === "COMPLETED").length;
  const totalMilestones = project.milestones.length;

  const formatLakh = (n: number) => {
    const l = n / 100000;
    return l >= 1 ? `₹${l.toFixed(1)}L` : `₹${Math.round(n / 1000)}K`;
  };

  const s = getStatusStyle(project.status);

  const endDate = project.endDate
    ? new Date(project.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Confirm dialog */}
      {confirming && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-1">Delete project?</h3>
            <p className="text-[12px] text-[#9999AA] mb-1 leading-relaxed">
              <span className="font-medium text-[#555570]">{project.title}</span>
            </p>
            <p className="text-[12px] text-[#9999AA] mb-5 leading-relaxed">
              This will permanently delete all milestones, expenditures, documents, and team records. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 rounded-lg border border-[#EBEBF0] text-[13px] font-medium text-[#555570] hover:bg-[#F5F5F7] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative group/card">
        <Link href={`/dashboard/projects/${project.id}`}>
          <div className="bg-white border border-[#EBEBF0] rounded-2xl p-5 hover:shadow-md hover:border-[#C5C0F5] transition-all cursor-pointer group">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#9999AA] font-medium mb-1 truncate">
                  {project.sanctionNumber}
                </p>
                <h3 className="text-[14px] font-semibold text-[#1A1A2E] leading-snug line-clamp-2 group-hover:text-[#5B4FE9] transition-colors">
                  {project.title}
                </h3>
              </div>
              <span className={`shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </div>

            {project.pi && (
              <p className="text-[12px] text-[#9999AA] mb-3">
                PI: <span className="text-[#555570] font-medium">{project.pi.name}</span>
              </p>
            )}

            <div className="mb-3">
              <div className="flex justify-between text-[11px] text-[#9999AA] mb-1">
                <span>Budget Used</span>
                <span>{formatLakh(totalSpent)} / {formatLakh(totalBudget)}</span>
              </div>
              <div className="h-1.5 bg-[#F0F0F5] rounded-full overflow-hidden">
                <div className="h-full bg-[#5B4FE9] rounded-full transition-all" style={{ width: `${Math.min(spentPct, 100)}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#F0F0F5]">
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-[#1A1A2E]">{doneMilestones}/{totalMilestones}</p>
                  <p className="text-[10px] text-[#9999AA]">Milestones</p>
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-[#1A1A2E]">{project.personnelRecords.length}</p>
                  <p className="text-[10px] text-[#9999AA]">Members</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-[#1A1A2E]">{endDate}</p>
                <p className="text-[10px] text-[#9999AA]">End date</p>
              </div>
            </div>
          </div>
        </Link>

        {/* Delete button — PI only, appears on hover */}
        {isPI && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirming(true);
            }}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white border border-[#EBEBF0] text-[#9999AA] hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all opacity-0 group-hover/card:opacity-100 flex items-center justify-center shadow-sm z-10"
            title="Delete project"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}