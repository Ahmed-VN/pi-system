import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome, {session.user?.name}!
        </h1>
        <p className="text-gray-600 mb-8">
          Role: {session.user?.role} | Project Management System
        </p>
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <p className="text-gray-700">
            🎉 Authentication is working! Dashboard coming in Phase 4.
          </p>
        </div>
      </div>
    </div>
  )
}