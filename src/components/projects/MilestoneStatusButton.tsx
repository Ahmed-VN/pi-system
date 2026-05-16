'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface MilestoneStatusButtonProps {
  milestoneId: string
  currentStatus: string
}

export default function MilestoneStatusButton({ milestoneId, currentStatus }: MilestoneStatusButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(newStatus: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: milestoneId, status: newStatus }),
      })

      if (res.ok) {
        toast.success(`Milestone marked as ${newStatus.replace('_', ' ')}`)
        router.refresh()
      } else {
        toast.error('Failed to update milestone')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (currentStatus === 'COMPLETED') {
    return (
      <button
        onClick={() => updateStatus('PENDING')}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
      >
        {loading ? '...' : 'Undo'}
      </button>
    )
  }

  return (
    <div className="flex gap-2 ml-2">
      {currentStatus !== 'IN_PROGRESS' && (
        <button
          onClick={() => updateStatus('IN_PROGRESS')}
          disabled={loading}
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          {loading ? '...' : 'Start'}
        </button>
      )}
      <button
        onClick={() => updateStatus('COMPLETED')}
        disabled={loading}
        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
      >
        {loading ? '...' : '✓ Complete'}
      </button>
    </div>
  )
}