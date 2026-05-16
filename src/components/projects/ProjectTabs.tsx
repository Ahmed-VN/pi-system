'use client'

import { useState } from 'react'
import { formatCurrency, daysRemaining } from '@/lib/utils'
import ProgressRing from '@/components/dashboard/ProgressRing'

// ── Types ──────────────────────────────────────────────────
interface Milestone {
  id: string
  title: string
  description: string | null
  dueDate: Date
  status: string
  completedAt: Date | null
}

interface PersonnelRecord {
  id: string
  role: string
  stipend: any
  joinDate: Date
  user: { name: string; email: string; designation: string | null }
}

interface BudgetHead {
  id: string
  headName: string
  category: string
  allocatedAmount: any
}

interface Expenditure {
  id: string
  amount: any
  description: string
  expenditureDate: Date
  voucherNumber: string | null
  budgetHead: { headName: string }
}

interface Document {
  id: string
  title: string
  documentType: string
  fileUrl: string
  createdAt: Date
  uploadedBy: { name: string }
}

interface ProjectTabsProps {
  project: {
    id: string
    hostInstitution: string
    startDate: Date
    endDate: Date
    abstractText: string | null
    totalBudget: any
    milestones: Milestone[]
    personnelRecords: PersonnelRecord[]
    budgetHeads: BudgetHead[]
    expenditures: Expenditure[]
    documents: Document[]
  }
}

// ── Status helpers ─────────────────────────────────────────
const milestoneIcon: Record<string, string> = {
  COMPLETED: '✅',
  IN_PROGRESS: '🔄',
  DELAYED: '⚠️',
  PENDING: '⏳',
}

const milestoneColor: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DELAYED: 'bg-red-100 text-red-700',
  PENDING: 'bg-gray-100 text-gray-600',
}

// ── Main component ─────────────────────────────────────────
export default function ProjectTabs({ project }: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState('Overview')
  const tabs = ['Overview', 'Milestones', 'Team', 'Documents', 'Financials']

  const totalBudget = Number(project.totalBudget)
  const totalExpenditure = project.expenditures.reduce((s, e) => s + Number(e.amount), 0)
  const days = daysRemaining(new Date(project.endDate))

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────── */}
      {activeTab === 'Overview' && (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Project Details</h3>
              <div className="space-y-3">
                <div><p className="text-xs text-gray-500">Host Institution</p><p className="text-sm font-medium text-gray-800">{project.hostInstitution}</p></div>
                <div><p className="text-xs text-gray-500">Start Date</p><p className="text-sm font-medium text-gray-800">{new Date(project.startDate).toLocaleDateString('en-IN')}</p></div>
                <div><p className="text-xs text-gray-500">End Date</p><p className="text-sm font-medium text-gray-800">{new Date(project.endDate).toLocaleDateString('en-IN')}</p></div>
                <div><p className="text-xs text-gray-500">Days Remaining</p>
                  <p className={`text-sm font-bold ${days < 90 ? 'text-red-600' : days < 180 ? 'text-yellow-600' : 'text-green-600'}`}>{days} days</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Financial Summary</h3>
              <div className="space-y-3">
                <div><p className="text-xs text-gray-500">Total Budget</p><p className="text-sm font-bold text-gray-800">{formatCurrency(totalBudget)}</p></div>
                <div><p className="text-xs text-gray-500">Total Expenditure</p><p className="text-sm font-bold text-gray-800">{formatCurrency(totalExpenditure)}</p></div>
                <div><p className="text-xs text-gray-500">Balance</p><p className="text-sm font-bold text-green-600">{formatCurrency(totalBudget - totalExpenditure)}</p></div>
              </div>
            </div>
          </div>
          {project.abstractText && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Abstract</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{project.abstractText}</p>
            </div>
          )}
        </div>
      )}

      {/* ── MILESTONES ───────────────────────────────────── */}
      {activeTab === 'Milestones' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Milestones ({project.milestones.length})</h3>
          </div>
          {project.milestones.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">🎯</p>
              <p className="text-sm">No milestones added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{milestoneIcon[m.status]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.title}</p>
                      {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${milestoneColor[m.status]}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{new Date(m.dueDate).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEAM ─────────────────────────────────────────── */}
      {activeTab === 'Team' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Team Members ({project.personnelRecords.length})</h3>
          </div>
          {project.personnelRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm">No team members added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {project.personnelRecords.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                      {p.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.user.name}</p>
                      <p className="text-xs text-gray-500">{p.user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      {p.role.replace('_', '-')}
                    </span>
                    {p.stipend && <p className="text-xs text-gray-500 mt-1">₹{Number(p.stipend).toLocaleString('en-IN')}/mo</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS ────────────────────────────────────── */}
      {activeTab === 'Documents' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Documents ({project.documents.length})</h3>
          </div>
          {project.documents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📄</p>
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {project.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.title}</p>
                      <p className="text-xs text-gray-500">By {d.uploadedBy.name} · {new Date(d.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                    {d.documentType.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FINANCIALS ───────────────────────────────────── */}
      {activeTab === 'Financials' && (
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Budget Heads</h3>
          <div className="space-y-3 mb-6">
            {project.budgetHeads.map((b) => {
              const spent = project.expenditures
                .filter((e) => e.budgetHead?.headName === b.headName)
                .reduce((s, e) => s + Number(e.amount), 0)
              const allocated = Number(b.allocatedAmount)
              const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0

              return (
                <div key={b.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.category === 'RECURRING' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {b.category === 'RECURRING' ? 'Recurring' : 'Non-Recurring'}
                      </span>
                      <p className="text-sm font-medium text-gray-800">{b.headName}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(allocated)}</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                    <div className={`h-1.5 rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Spent: {formatCurrency(spent)}</span>
                    <span>{pct}% used</span>
                  </div>
                </div>
              )
            })}
          </div>

          {project.expenditures.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Expenditures</h3>
              <div className="space-y-2">
                {project.expenditures.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{e.description}</p>
                      <p className="text-xs text-gray-500">{e.budgetHead?.headName} · {new Date(e.expenditureDate).toLocaleDateString('en-IN')}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600">-{formatCurrency(Number(e.amount))}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {project.expenditures.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">💰</p>
              <p className="text-sm">No expenditures recorded yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}