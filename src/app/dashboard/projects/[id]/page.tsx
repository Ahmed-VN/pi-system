import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatCurrency, daysRemaining, projectProgress } from '@/lib/utils'
import ProgressRing from '@/components/dashboard/ProgressRing'

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
      expenditures: true,
      documents: { include: { uploadedBy: true } },
    },
  })

  if (!project) notFound()

  const progress = projectProgress(new Date(project.startDate), new Date(project.endDate))
  const days = daysRemaining(new Date(project.endDate))
  const totalExpenditure = project.expenditures.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div>
      {/* Back button */}
      <Link href="/dashboard/projects" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{project.title}</h1>
            <p className="text-sm text-gray-500 font-mono">{project.sanctionNumber}</p>
          </div>
          <ProgressRing progress={progress} size={80} strokeWidth={7} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab navigation */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-6">
            {['Overview', 'Milestones', 'Team', 'Documents', 'Financials'].map((tab) => (
              <button
                key={tab}
                className="py-4 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Project Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Host Institution</p>
                  <p className="text-sm font-medium text-gray-800">{project.hostInstitution}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(project.startDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(project.endDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Days Remaining</p>
                  <p className={`text-sm font-bold ${days < 90 ? 'text-red-600' : days < 180 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {days} days
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Financial Summary
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Total Budget</p>
                  <p className="text-sm font-bold text-gray-800">
                    {formatCurrency(Number(project.totalBudget))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Expenditure</p>
                  <p className="text-sm font-bold text-gray-800">
                    {formatCurrency(totalExpenditure)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className="text-sm font-bold text-green-600">
                    {formatCurrency(Number(project.totalBudget) - totalExpenditure)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {project.abstractText && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Abstract
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{project.abstractText}</p>
            </div>
          )}

          {/* Milestones preview */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Milestones ({project.milestones.length})
            </h3>
            <div className="space-y-2">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {m.status === 'COMPLETED' ? '✅' : m.status === 'IN_PROGRESS' ? '🔄' : m.status === 'DELAYED' ? '⚠️' : '⏳'}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{m.title}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(m.dueDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Team preview */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Team ({project.personnelRecords.length})
            </h3>
            <div className="space-y-2">
              {project.personnelRecords.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.user.name}</p>
                    <p className="text-xs text-gray-500">{p.user.email}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    {p.role.replace('_', '-')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget Heads */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Budget Heads
            </h3>
            <div className="space-y-2">
              {project.budgetHeads.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${b.category === 'RECURRING' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {b.category === 'RECURRING' ? 'R' : 'NR'}
                    </span>
                    <p className="text-sm font-medium text-gray-800">{b.headName}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-800">
                    {formatCurrency(Number(b.allocatedAmount))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
