import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProjectCard from '@/components/dashboard/ProjectCard'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const projects = await prisma.project.findMany({
    where: { piId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  const activeProjects = projects.filter(p => p.status === 'ACTIVE').length
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.totalBudget), 0)
  const closedProjects = projects.filter(p => p.status === 'CLOSED').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Overview of your ANRF research projects
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Active Projects</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{activeProjects}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Budget</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            ₹{(totalBudget / 100000).toFixed(1)}L
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Completed Projects</p>
          <p className="text-3xl font-bold text-gray-600 mt-1">{closedProjects}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Your Projects</h2>
        <span className="text-sm text-gray-500">{projects.length} total</span>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-gray-600 font-medium">No projects yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Your ANRF projects will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}