'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddMilestoneFormProps {
  projectId: string
  onSuccess?: () => void
}

export default function AddMilestoneForm({ projectId, onSuccess }: AddMilestoneFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, projectId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to add milestone')
      } else {
        toast.success('Milestone added successfully!')
        setForm({ title: '', description: '', dueDate: '' })
        setOpen(false)
        router.refresh()
        onSuccess?.()
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        size="sm"
        onClick={() => setOpen(!open)}
        className="bg-blue-600 hover:bg-blue-700 text-white"
      >
        {open ? 'Cancel' : '+ Add Milestone'}
      </Button>

      {open && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">New Milestone</h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="title" className="text-xs">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Milestone title"
                value={form.title}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-xs">Description (optional)</Label>
              <Input
                id="description"
                name="description"
                placeholder="Brief description"
                value={form.description}
                onChange={handleChange}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dueDate" className="text-xs">Due Date</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleChange}
                required
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Adding...' : 'Add Milestone'}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}