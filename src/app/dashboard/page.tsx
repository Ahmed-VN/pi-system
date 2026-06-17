import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectCard from "@/components/dashboard/ProjectCard";
import NotificationBell from "@/components/dashboard/NotificationBell";
import Link from "next/link";
import { Prisma } from "@prisma/client";

type RawProject = Prisma.ProjectGetPayload<{
  include: {
    pi: { select: { name: true; email: true } };
    budgetHeads: {
      include: { expenditures: { select: { amount: true } } };
    };
    milestones: { select: { status: true } };
    personnelRecords: { select: { id: true } };
  };
}>;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true, name: true },
  });

  const rawProjects: RawProject[] = await prisma.project.findMany({
    where: {
      OR: [
        { pi: { email: session.user.email! } },
        { personnelRecords: { some: { user: { email: session.user.email! } } } },
      ],
    },
    include: {
      pi: { select: { name: true, email: true } },
      budgetHeads: {
        include: { expenditures: { select: { amount: true } } },
      },
      milestones: { select: { status: true } },
      personnelRecords: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const projects = rawProjects.map((p: RawProject) => ({
    id: p.id,
    title: p.title,
    sanctionNumber: p.sanctionNumber,
    status: p.status as string,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    endDate: p.endDate ? p.endDate.toISOString() : null,
    pi: p.pi ? { name: p.pi.name ?? "", email: p.pi.email ?? "" } : null,
    budgetHeads: p.budgetHeads.map((b) => ({
      allocatedAmount: Number(b.allocatedAmount),
      expenditures: b.expenditures.map((e) => ({ amount: Number(e.amount) })),
    })),
    milestones: p.milestones.map((m) => ({ status: m.status as string })),
    personnelRecords: p.personnelRecords,
  }));

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const pendingProjects = projects.filter((p) => p.status === "PENDING").length;
  const closedProjects = projects.filter(
    (p) => p.status === "CLOSED" || p.status === "EXTENDED"
  ).length;

  const totalBudget = projects.reduce(
    (sum, p) => sum + p.budgetHeads.reduce((s, b) => s + b.allocatedAmount, 0),
    0
  );
  const totalSpent = projects.reduce(
    (sum, p) =>
      sum +
      p.budgetHeads.reduce(
        (s, b) => s + b.expenditures.reduce((e, x) => e + x.amount, 0),
        0
      ),
    0
  );
  const totalMilestones = projects.reduce((sum, p) => sum + p.milestones.length, 0);
  const doneMilestones = projects.reduce(
    (sum, p) => sum + p.milestones.filter((m) => m.status === "COMPLETED").length,
    0
  );
  const totalMembers = projects.reduce((sum, p) => sum + p.personnelRecords.length, 0);

  const formatLakh = (n: number) => {
    const l = n / 100000;
    return l >= 1 ? `₹${l.toFixed(1)}L` : `₹${Math.round(n / 1000)}K`;
  };

  const piName = session.user.name ?? session.user.email ?? "User";
  const initials = piName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join("");

  const roleLabels: Record<string, string> = {
    PI: "Principal Investigator",
    CO_PI: "Co-Investigator",
    JRF: "Junior Research Fellow",
    ADMIN: "Administrator",
  };
  const roleLabel = roleLabels[currentUser?.role ?? "PI"] ?? "Researcher";

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* ── Header ── */}
      <header className="bg-white border-b border-[#EBEBF0] sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 h-14">
          <h1 className="text-[15px] font-semibold text-[#1A1A2E] tracking-tight flex-1">
            Dashboard
          </h1>
          <NotificationBell />
          <div className="flex items-center gap-2 ml-1">
            <div className="w-8 h-8 rounded-full bg-[#EEF0FF] flex items-center justify-center text-[11px] font-bold text-[#5B4FE9]">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-[12px] font-medium text-[#1A1A2E] leading-none">
                {piName.split(" ")[0]}
              </p>
              <p className="text-[10px] text-[#9999AA] leading-none mt-0.5">
                {roleLabel}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 max-w-6xl mx-auto">
        {/* ── Greeting ── */}
        <div className="mb-6">
          <h2 className="text-[20px] font-semibold text-[#1A1A2E] tracking-tight">
            {greeting()}, {piName.split(" ")[0]} 👋
          </h2>
          <p className="text-[13px] text-[#9999AA] mt-0.5">
            Here&apos;s a snapshot of your ANRF projects.
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {[
            {
              label: "Active Projects",
              value: activeProjects,
              sub: `of ${projects.length} total`,
              accent: "#5B4FE9",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              ),
            },
            {
              label: "Total Budget",
              value: formatLakh(totalBudget),
              sub: `${formatLakh(totalSpent)} spent`,
              accent: "#F59E0B",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              ),
            },
            {
              label: "Milestones Done",
              value: `${doneMilestones}/${totalMilestones}`,
              sub: `${totalMilestones - doneMilestones} remaining`,
              accent: "#22C55E",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ),
            },
            {
              label: "Team Members",
              value: totalMembers,
              sub: "across all projects",
              accent: "#06B6D4",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              ),
            },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[#EBEBF0] rounded-xl p-4 relative overflow-hidden">
              <div className="absolute right-0 top-3 bottom-3 w-0.75 rounded-l-full" style={{ background: s.accent }} />
              <div className="flex items-center gap-1.5 text-[11px] text-[#9999AA] font-medium mb-2">
                <span style={{ color: s.accent }}>{s.icon}</span>
                {s.label}
              </div>
              <div className="text-[22px] font-semibold text-[#1A1A2E] tracking-tight leading-none">{s.value}</div>
              <div className="text-[11px] text-[#9999AA] mt-1.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Section header ── */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-[#1A1A2E]">All Projects</h3>
          {currentUser?.role === "PI" && (
            <Link
              href="/dashboard/projects/new"
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-[#5B4FE9] text-white hover:bg-[#4A3FD8] transition-colors flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Project
            </Link>
          )}
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { label: `All (${projects.length})`,              key: "ALL"     },
            { label: `Active (${activeProjects})`,            key: "ACTIVE"  },
            { label: `Pending (${pendingProjects})`,          key: "PENDING" },
            { label: `Closed / Extended (${closedProjects})`, key: "CLOSED"  },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "ALL" ? "/dashboard" : `/dashboard?filter=${tab.key}`}
              className="text-[12px] font-medium px-3 py-1.5 rounded-full border transition-colors bg-white border-[#EBEBF0] text-[#555570] hover:bg-[#F5F5F7]"
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* ── Project grid ── */}
        {projects.length === 0 ? (
          <div className="bg-white border border-[#EBEBF0] rounded-2xl p-16 text-center">
            <div className="w-12 h-12 bg-[#EEF0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5B4FE9" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-[#1A1A2E] mb-1">No projects yet</p>
            <p className="text-[13px] text-[#9999AA]">
              {currentUser?.role === "PI"
                ? "Create your first ANRF project to get started."
                : "You have not been added to any projects yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}