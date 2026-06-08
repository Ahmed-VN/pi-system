'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type MessageType = 'CHAT' | 'DAILY_REPORT' | 'FEEDBACK'

interface Sender {
  id: string
  name: string
  role: string
}

interface Message {
  id: string
  content: string
  messageType: MessageType
  sender: Sender
  createdAt: string
  parentId?: string
  replies?: Message[]
}

interface Thread {
  id: string
  title: string
  messages: Message[]
  updatedAt: string
}

type SidebarView = 'chat' | 'daily_reports'

const DAILY_REPORT_ROLES = ['PI', 'JRF']

export default function MessagingTab({ projectId }: { projectId: string }) {
  const { data: session } = useSession()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [sidebarView, setSidebarView] = useState<SidebarView>('chat')
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isFirstLoad = useRef(true)

  const userRole = (session?.user as { role?: string })?.role ?? ''
  const canSeeDailyReports = DAILY_REPORT_ROLES.includes(userRole)

  // Only the single General Chat thread (API guarantees at most one per project)
  const chatThreads = threads.filter(t => t.title === 'General Chat')

  // All messages across all threads that are DAILY_REPORT or FEEDBACK on a report
  const reportMessages = threads.flatMap(t =>
    t.messages.filter(m => m.messageType === 'DAILY_REPORT' || m.messageType === 'FEEDBACK')
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // For JRF: only their own reports + feedback on them
  const visibleReports = userRole === 'PI'
    ? reportMessages
    : reportMessages.filter(m =>
        m.sender.id === session?.user?.id ||
        (m.messageType === 'FEEDBACK' && m.parentId &&
          reportMessages.find(r => r.id === m.parentId)?.sender.id === session?.user?.id)
      )

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/messages?projectId=${projectId}`)
      const data: Thread[] = await res.json()
      setThreads(data)
      if (isFirstLoad.current && data.length > 0) {
        setActiveThread(data[0])
        isFirstLoad.current = false
      }
    }
    load()
  }, [projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread])

  const fetchThreads = async () => {
    const res = await fetch(`/api/messages?projectId=${projectId}`)
    const data: Thread[] = await res.json()
    setThreads(data)
    return data
  }

  const sendMessage = async (overrideType?: MessageType) => {
    if (!content.trim()) return
    const msgType: MessageType = overrideType ?? (sidebarView === 'daily_reports' ? 'DAILY_REPORT' : 'CHAT')
    setLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          content,
          messageType: msgType,
          threadId: activeThread?.id,
          parentId: replyTo?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setContent('')
      setReplyTo(null)
      const updated = await fetchThreads()
      if (sidebarView === 'chat') {
        const refreshed = updated.find((t: Thread) => t.id === data.thread.id)
        if (refreshed) setActiveThread(refreshed)
      }
      toast.success(msgType === 'DAILY_REPORT' ? 'Daily report submitted!' : 'Message sent!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const roleColor: Record<string, string> = {
    PI: 'bg-violet-100 text-violet-700',
    CO_PI: 'bg-blue-100 text-blue-700',
    JRF: 'bg-emerald-100 text-emerald-700',
    ADMIN: 'bg-gray-100 text-gray-700',
  }

  const pendingReportCount = visibleReports.filter(m =>
    m.messageType === 'DAILY_REPORT' &&
    !reportMessages.find(r => r.messageType === 'FEEDBACK' && r.parentId === m.id)
  ).length

  return (
    <div className="flex h-150 border rounded-xl overflow-hidden bg-white">
      {/* ── Sidebar ── */}
      <div className="w-56 border-r bg-gray-50 flex flex-col">
        <div className="p-3 border-b font-semibold text-sm text-gray-700">Messages</div>

        {/* Chat conversations */}
        <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Conversations
        </div>
        <div className="flex-1 overflow-y-auto">
          {chatThreads.length === 0 && sidebarView === 'chat' && (
            <p className="text-xs text-gray-400 px-3 py-2">No conversations yet.</p>
          )}
          {chatThreads.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveThread(t); setSidebarView('chat') }}
              className={`w-full text-left px-3 py-2 text-sm border-b hover:bg-gray-100 transition ${
                sidebarView === 'chat' && activeThread?.id === t.id
                  ? 'bg-violet-50 border-l-2 border-l-violet-500 text-violet-700 font-medium'
                  : 'text-gray-600'
              }`}
            >
              <div className="truncate">{t.title || 'General Chat'}</div>
              <div className="text-xs text-gray-400">
                {t.messages.filter(m => m.messageType === 'CHAT').length} msgs
              </div>
            </button>
          ))}

          {/* Daily Reports — immediately below chat threads, PI & JRF only */}
          {canSeeDailyReports && (
            <button
              onClick={() => setSidebarView('daily_reports')}
              className={`w-full text-left px-3 py-2 text-sm border-b hover:bg-gray-100 transition flex items-center justify-between ${
                sidebarView === 'daily_reports'
                  ? 'bg-emerald-50 border-l-2 border-l-emerald-500 text-emerald-700 font-medium'
                  : 'text-gray-600'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Daily Reports</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 pl-5">PI · JRF only</div>
              </div>
              {pendingReportCount > 0 && (
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                  {pendingReportCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── CHAT VIEW ── */}
        {sidebarView === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!activeThread && (
                <div className="text-center text-sm text-gray-400 mt-16">
                  Select a conversation or start a new one
                </div>
              )}
              {activeThread?.messages
                .filter(m => m.messageType === 'CHAT')
                .map(msg => {
                  const isMe = msg.sender.id === session?.user?.id
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {!isMe && <span className="font-medium text-gray-700">{msg.sender.name}</span>}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleColor[msg.sender.role]}`}>
                            {msg.sender.role.replace('_', '-')}
                          </span>
                        </div>
                        <div
                          className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                            isMe
                              ? 'bg-violet-600 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            className="text-[10px] text-violet-500 hover:underline"
                            onClick={() => setReplyTo(msg)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3 space-y-2 bg-gray-50">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs bg-violet-50 px-2 py-1 rounded">
                  <span className="text-violet-600">Replying to {replyTo.sender.name}:</span>
                  <span className="text-gray-500 truncate">{replyTo.content.slice(0, 60)}</span>
                  <button onClick={() => setReplyTo(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Type a message..."
                  rows={2}
                  className="text-sm resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage('CHAT') }
                  }}
                />
                <Button
                  onClick={() => sendMessage('CHAT')}
                  disabled={loading || !content.trim()}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-4"
                >
                  {loading ? '...' : 'Send'}
                </Button>
              </div>
              <p className="text-[10px] text-gray-400">Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}

        {/* ── DAILY REPORTS VIEW ── */}
        {sidebarView === 'daily_reports' && canSeeDailyReports && (
          <>
            <div className="border-b px-4 py-2.5 bg-emerald-50 flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-800">Daily Reports</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {userRole === 'PI' ? 'All JRF reports' : 'Your submissions'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {visibleReports.filter(m => m.messageType === 'DAILY_REPORT').length === 0 && (
                <div className="text-center text-sm text-gray-400 mt-16">
                  {userRole === 'JRF' ? 'No reports submitted yet. Submit your first daily report below.' : 'No daily reports submitted yet.'}
                </div>
              )}

              {visibleReports
                .filter(m => m.messageType === 'DAILY_REPORT')
                .map(report => {
                  const feedback = visibleReports.find(
                    m => m.messageType === 'FEEDBACK' && m.parentId === report.id
                  )
                  const isMyReport = report.sender.id === session?.user?.id
                  return (
                    <div
                      key={report.id}
                      className="border rounded-xl bg-white overflow-hidden"
                    >
                      {/* Report header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {isMyReport ? 'You' : report.sender.name}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleColor[report.sender.role]}`}>
                            {report.sender.role.replace('_', '-')}
                          </span>
                          {feedback ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                              ✓ Reviewed
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                              Awaiting feedback
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {new Date(report.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Report body */}
                      <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {report.content}
                      </div>

                      {/* Feedback block */}
                      {feedback && (
                        <div className="mx-4 mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold text-amber-700">PI Feedback</span>
                            <span className="text-[10px] text-gray-400">
                              · {new Date(feedback.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 leading-relaxed">{feedback.content}</p>
                        </div>
                      )}

                      {/* PI: give feedback inline if not yet given */}
                      {userRole === 'PI' && !feedback && (
                        <FeedbackInline
                          reportId={report.id}
                          threadId={threads.find(t => t.messages.some(m => m.id === report.id))?.id ?? ''}
                          projectId={projectId}
                          onSent={fetchThreads}
                        />
                      )}
                    </div>
                  )
                })}
              <div ref={bottomRef} />
            </div>

            {/* JRF: submit report */}
            {userRole === 'JRF' && (
              <div className="border-t p-3 space-y-2 bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600">📋 Submit today&apos;s report</span>
                  <span className="text-[10px] text-gray-400">· Visible to PI only</span>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="What did you work on today? Any blockers?"
                    rows={3}
                    className="text-sm resize-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage('DAILY_REPORT') }
                    }}
                  />
                  <Button
                    onClick={() => sendMessage('DAILY_REPORT')}
                    disabled={loading || !content.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4"
                  >
                    {loading ? '...' : 'Submit'}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400">Enter to submit · Shift+Enter for new line</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Inline feedback composer for PI ──
function FeedbackInline({
  reportId,
  threadId,
  projectId,
  onSent,
}: {
  reportId: string
  threadId: string
  projectId: string
  onSent: () => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          content: text,
          messageType: 'FEEDBACK',
          threadId,
          parentId: reportId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setText('')
      setOpen(false)
      onSent()
      toast.success('Feedback sent!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 pb-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-violet-600 hover:underline"
        >
          ✏️ Give feedback
        </button>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write your feedback for this report..."
            rows={2}
            className="text-sm resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={submit}
              disabled={loading || !text.trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
            >
              {loading ? '...' : 'Send Feedback'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => { setOpen(false); setText('') }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}