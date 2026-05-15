import { formatCurrency, daysRemaining, projectProgress } from '@/lib/utils'
import ProgressRing from './ProgressRing'
import Link from 'next/link'

interface ProjectCardProps {
  project: {
    id: string
    title: string
    shortTitle?: string | null
    grantType: string
    sanctionNumber: string
    startDate: Date
    endDate: Date
    status: string
    hostInstitution: string
    totalBudget: any
  }
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  EXTENDED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
  PENDING: 'bg-blue-100 text-blue-700 border-blue-200',
}

const grantColors: Record<string, string> = {
  ARG: 'bg-purple-100 text-purple-700',
  IRG: 'bg-indigo-100 text-indigo-700',
  PM_ECRG: 'bg-orange-100 text-orange-700',
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const progress = projectProgress(
    new Date(project.startDate),
    new Date(project.endDate)
  )
  const days = daysRemaining(new Date(project.endDate))
  const budget = typeof project.totalBudget === 'object'
    ? Number(project.totalBudget)
    : project.totalBudget

  return (
    <Link href={`/dashboard/projects/${project.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${grantColors[project.grantType]}`}>
                {project.grantType}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[project.status]}`}>
                {project.status}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {project.title}
            </h3>
          </div>
          <div className="ml-3 flex-shrink-0">
            <ProgressRing progress={progress} size={56} strokeWidth={5} />
          </div>
        </div>

        {/* Sanction number */}
        <p className="text-xs text-gray-500 mb-3 font-mono">
          {project.sanctionNumber}
        </p>

        {/* Institution */}
        <p className="text-xs text-gray-600 mb-4 truncate">
          🏛️ {project.hostInstitution}
        </p>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Total Budget</p>
            <p className="text-sm font-bold text-gray-800">
              {formatCurrency(budget)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Days Remaining</p>
            <p className={`text-sm font-bold ${days < 90 ? 'text-red-600' : days < 180 ? 'text-yellow-600' : 'text-green-600'}`}>
              {days} days
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}