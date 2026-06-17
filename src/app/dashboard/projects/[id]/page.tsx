import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProjectTabs from "@/components/projects/ProjectTabs";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  // Get current user role
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, role: true },
  });

  const raw = await prisma.project.findFirst({
    where: {
      id,
      OR: [
        { pi: { email: session.user.email! } },
        { personnelRecords: { some: { user: { email: session.user.email! } } } },
      ],
    },
    include: {
      pi: { select: { id: true, name: true, email: true } },
      milestones: { orderBy: { dueDate: "asc" } },
      budgetHeads: { include: { expenditures: true } },
      personnelRecords: {
        include: {
          user: { select: { id: true, name: true, email: true, designation: true } },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!raw) redirect("/dashboard/projects");

  // Determine effective role for this project
  // If user is the PI → role is PI
  // Otherwise check their personnelRecord role for this project
  let userRole = currentUser?.role ?? "JRF";
  if (raw.pi.email === session.user.email) {
    userRole = "PI";
  } else {
    const record = raw.personnelRecords.find(
      (r) => r.user.email === session.user.email
    );
    if (record) userRole = record.role;
  }

  const project = {
    id: raw.id,
    title: raw.title,
    sanctionNumber: raw.sanctionNumber,
    grantType: raw.grantType as string,
    status: raw.status as string,
    totalBudget: Number(raw.totalBudget),
    startDate: raw.startDate.toISOString(),
    endDate: raw.endDate.toISOString(),
    description: raw.abstractText ?? null,
    pi: { id: raw.pi.id, name: raw.pi.name, email: raw.pi.email },
    milestones: raw.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? null,
      dueDate: m.dueDate.toISOString(),
      completedAt: m.completedAt?.toISOString() ?? null,
      status: m.status as string,
      createdAt: m.createdAt.toISOString(),
    })),
    budgetHeads: raw.budgetHeads.map((b) => ({
      id: b.id,
      name: b.headName,
      allocatedAmount: Number(b.allocatedAmount),
      category: b.category as string,
      expenditures: b.expenditures.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        description: e.description,
        date: e.expenditureDate.toISOString(),
        invoiceNumber: e.voucherNumber ?? null,
        vendor: null,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
    personnelRecords: raw.personnelRecords.map((r) => ({
      id: r.id,
      role: r.role as string,
      stipend: r.stipend ? Number(r.stipend) : null,
      joinDate: r.joinDate?.toISOString() ?? null,
      user: { id: r.user.id, name: r.user.name, email: r.user.email },
    })),
    documents: raw.documents.map((d) => ({
  id: d.id,
  name: d.title,
  type: d.documentType as string,
  url: d.fileUrl,
  uploadedAt: d.createdAt.toISOString(),
  expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,  // add this line
})),
  };

  function statusBadgeStyle(status: string) {
    if (status === "ACTIVE") return { bg: "#E8F5E9", text: "#2E7D32", dot: "#4CAF50" };
    if (status === "EXTENDED") return { bg: "#E3F2FD", text: "#1565C0", dot: "#2196F3" };
    if (status === "PENDING") return { bg: "#FFF8E1", text: "#F57F17", dot: "#FFC107" };
    return { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" };
  }

  const badge = statusBadgeStyle(project.status);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="bg-white border-b border-[#EBEBF0] px-6 h-14 flex items-center gap-2 sticky top-0 z-10">
        <Link
          href="/dashboard/projects"
          className="text-[12px] text-[#9999AA] hover:text-[#5B4FE9] flex items-center gap-1 transition-colors"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Projects
        </Link>
        <span className="text-[#EBEBF0] text-sm">/</span>
        <span className="text-[13px] font-medium text-[#1A1A2E] truncate max-w-100">
          {project.title}
        </span>
        {/* Role badge */}
        <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#5B4FE9]">
          {userRole === "PI" ? "Principal Investigator" :
           userRole === "CO_PI" ? "Co-Investigator" :
           userRole === "JRF" ? "Junior Research Fellow" : userRole}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-[#EBEBF0] p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="inline-block bg-[#EEF2FF] text-[#5B4FE9] text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md mb-3">
                {project.grantType}
              </div>
              <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-snug mb-1">
                {project.title}
              </h1>
              <p className="text-[12px] text-[#9999AA]">
                {raw.hostInstitution} · {project.sanctionNumber}
              </p>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold shrink-0"
              style={{ background: badge.bg, color: badge.text }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: badge.dot }} />
              {project.status}
            </div>
          </div>

          <div className="flex gap-8 mt-5 pt-5 border-t border-[#EBEBF0] flex-wrap">
            {[
              { label: "Start Date", value: new Date(project.startDate).toLocaleDateString("en-IN") },
              { label: "End Date", value: new Date(project.endDate).toLocaleDateString("en-IN") },
              { label: "Total Budget", value: `₹${(project.totalBudget / 100000).toFixed(1)}L` },
              { label: "PI", value: project.pi.name },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] font-semibold text-[#9999AA] uppercase tracking-wider mb-1">
                  {item.label}
                </p>
                <p className="text-[14px] font-semibold text-[#1A1A2E]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#EBEBF0] p-6 shadow-sm">
          <ProjectTabs project={project} userRole={userRole} />
        </div>
      </div>
    </div>
  );
}