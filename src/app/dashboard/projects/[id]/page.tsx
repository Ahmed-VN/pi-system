import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { projectProgress } from '@/lib/utils'
import ProgressRing from '@/components/dashboard/ProgressRing'
import ProjectTabs from '@/components/projects/ProjectTabs'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { dueDate: 'asc' } },
      personnelRecords: { include: { user: true } },
      budgetHeads: true,
      expenditures: { include: { budgetHead: true } },
      documents: { include: { uploadedBy: true } },
    },
  })

  if (!project) notFound()

  const progress = projectProgress(
    new Date(project.startDate),
    new Date(project.endDate)
  )

  return (
    <div>
      <Link
        href="/dashboard/projects"
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Back to Projects
      </Link>

      {/* Project header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                {project.grantType}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                {project.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {project.title}
            </h1>
            <p className="text-sm text-gray-500 font-mono">
              {project.sanctionNumber}
            </p>
          </div>
          <ProgressRing progress={progress} size={80} strokeWidth={7} />
        </div>
      </div>

      {/* Interactive tabs */}
      <ProjectTabs project={project} />
    </div>
  )
}