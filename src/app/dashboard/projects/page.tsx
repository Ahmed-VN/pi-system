import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectCard from "@/components/dashboard/ProjectCard";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rawProjects = await prisma.project.findMany({
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

  const projects = rawProjects.map((p) => ({
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-gray-500 text-sm mt-1">All your ANRF research projects</p>
      </div>
      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-gray-600 font-medium">No projects yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}