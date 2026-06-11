'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Paperclip, X, FileText, Image, File, Download } from 'lucide-react'

type MessageType = 'CHAT' | 'DAILY_REPORT' | 'FEEDBACK'

interface Sender {
  id: string
  name: string
  role: string
}

interface Attachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
}

interface Message {
  id: string
  content: string
  messageType: MessageType
  sender: Sender
  createdAt: string
  parentId?: string
  replies?: Message[]
  attachments: Attachment[]
}

interface Thread {
  id: string
  title: string
  messages: Message[]
  updatedAt: string
}

interface PendingFile {
  file: File
  preview?: string
}

type SidebarView = 'chat' | 'daily_reports'

const DAILY_REPORT_ROLES = ['PI', 'JRF']

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentIcon({ mimeType }: { mimeType?: string }) {
  if (mimeType?.startsWith('image/')) return <Image className="w-4 h-4" />
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4" />
  return <File className="w-4 h-4" />
}

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mimeType?.startsWith('image/')
  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition text-xs border border-white/30 group"
      download={!isImage}
    >
      <AttachmentIcon mimeType={attachment.mimeType} />
      <span className="truncate max-w-[120px]">{attachment.fileName}</span>
      {attachment.fileSize && (
        <span className="opacity-60 shrink-0">{formatBytes(attachment.fileSize)}</span>
      )}
      <Download className="w-3 h-3 opacity-0 group-hover:opacity-100 transition shrink-0" />
    </a>
  )
}

export default function MessagingTab({ projectId }: { projectId: string }) {
  const { data: session } = useSession()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [sidebarView, setSidebarView] = useState<SidebarView>('chat')
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isFirstLoad = useRef(true)

  const userRole = (session?.user as { role?: string })?.role ?? ''
  const canSeeDailyReports = DAILY_REPORT_ROLES.includes(userRole)

  const chatThreads = threads.filter(t => t.title === 'General Chat')

  const reportMessages = threads
    .flatMap(t =>
      t.messages.filter(m => m.messageType === 'DAILY_REPORT' || m.messageType === 'FEEDBACK')
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const visibleReports =
    userRole === 'PI'
      ? reportMessages
      : reportMessages.filter(
          m =>
            m.sender.id === session?.user?.id ||
            (m.messageType === 'FEEDBACK' &&
              m.parentId &&
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (pendingFiles.length + files.length > 5) {
      toast.error('Maximum 5 files per message')
      return
    }
    const newPending: PendingFile[] = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setPendingFiles(prev => [...prev, ...newPending])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setPendingFiles(prev => {
      const updated = [...prev]
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!)
      updated.splice(index, 1)
      return updated
    })
  }

  const uploadFiles = async (): Promise<Attachment[]> => {
    const uploaded: Attachment[] = []
    for (const { file } of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      uploaded.push({ id: '', ...data })
    }
    return uploaded
  }

  const sendMessage = async (overrideType?: MessageType) => {
    if (!content.trim() && pendingFiles.length === 0) return
    const msgType: MessageType =
      overrideType ?? (sidebarView === 'daily_reports' ? 'DAILY_REPORT' : 'CHAT')
    setLoading(true)
    try {
      let attachments: Attachment[] = []
      if (pendingFiles.length > 0) {
        setUploading(true)
        attachments = await uploadFiles()
        setUploading(false)
        setPendingFiles([])
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          content,
          messageType: msgType,
          threadId: activeThread?.id,
          parentId: replyTo?.id,
          attachments,
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
      setUploading(false)
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

  const pendingReportCount = visibleReports.filter(
    m =>
      m.messageType === 'DAILY_REPORT' &&
      !reportMessages.find(r => r.messageType === 'FEEDBACK' && r.parentId === m.id)
  ).length

  return (
    <div className="flex h-150 border rounded-xl overflow-hidden bg-white">
      {/* ── Sidebar ── */}
      <div className="w-56 border-r bg-gray-50 flex flex-col">
        <div className="p-3 border-b font-semibold text-sm text-gray-700">Messages</div>
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
              onClick={() => {
                setActiveThread(t)
                setSidebarView('chat')
              }}
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
                      <div
                        className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}
                      >
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {!isMe && (
                            <span className="font-medium text-gray-700">{msg.sender.name}</span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleColor[msg.sender.role]}`}
                          >
                            {msg.sender.role.replace('_', '-')}
                          </span>
                        </div>

                        {/* Message bubble */}
                        <div
                          className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                            isMe
                              ? 'bg-violet-600 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-800 rounded-bl-none'
                          }`}
                        >
                          {msg.content && <p>{msg.content}</p>}

                          {/* Attachments */}
                          {msg.attachments?.length > 0 && (
                            <div className={`flex flex-wrap gap-1.5 ${msg.content ? 'mt-2' : ''}`}>
                              {msg.attachments.map((att: Attachment) => {
                                const isImage = att.mimeType?.startsWith('image/')
                                if (isImage) {
                                  return (
                                    <a
                                      key={att.id}
                                      href={att.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={att.fileUrl}
                                        alt={att.fileName}
                                        className="rounded-lg max-w-[200px] max-h-[160px] object-cover border border-white/30 hover:opacity-90 transition"
                                      />
                                    </a>
                                  )
                                }
                                return <AttachmentChip key={att.id} attachment={att} />
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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

            {/* ── Chat input ── */}
            <div className="border-t p-3 space-y-2 bg-gray-50">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs bg-violet-50 px-2 py-1 rounded">
                  <span className="text-violet-600">Replying to {replyTo.sender.name}:</span>
                  <span className="text-gray-500 truncate">{replyTo.content.slice(0, 60)}</span>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="ml-auto text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Pending file previews */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                  {pendingFiles.map((pf, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 text-xs text-violet-700"
                    >
                      {pf.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pf.preview} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <AttachmentIcon mimeType={pf.file.type} />
                      )}
                      <span className="truncate max-w-[100px]">{pf.file.name}</span>
                      <span className="text-violet-400">{formatBytes(pf.file.size)}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-violet-400 hover:text-violet-600 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={handleFileChange}
                />
                {/* Paperclip button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || pendingFiles.length >= 5}
                  className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition disabled:opacity-40"
                  title="Attach file (PDF, Word, Excel, Image)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Type a message..."
                  rows={2}
                  className="text-sm resize-none flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage('CHAT')
                    }
                  }}
                />
                <Button
                  onClick={() => sendMessage('CHAT')}
                  disabled={loading || (!content.trim() && pendingFiles.length === 0)}
                  className="bg-violet-600 hover:bg-violet-700 text-white px-4"
                >
                  {uploading ? '⬆️' : loading ? '...' : 'Send'}
                </Button>
              </div>
              <p className="text-[10px] text-gray-400">
                Enter to send · Shift+Enter for new line · 📎 up to 5 files · max 10 MB each
              </p>
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
                  {userRole === 'JRF'
                    ? 'No reports submitted yet. Submit your first daily report below.'
                    : 'No daily reports submitted yet.'}
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
                    <div key={report.id} className="border rounded-xl bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {isMyReport ? 'You' : report.sender.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleColor[report.sender.role]}`}
                          >
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
                          {new Date(report.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {' · '}
                          {new Date(report.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {report.content}
                      </div>
                      {feedback && (
                        <div className="mx-4 mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold text-amber-700">
                              PI Feedback
                            </span>
                            <span className="text-[10px] text-gray-400">
                              ·{' '}
                              {new Date(feedback.createdAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 leading-relaxed">{feedback.content}</p>
                        </div>
                      )}
                      {userRole === 'PI' && !feedback && (
                        <FeedbackInline
                          reportId={report.id}
                          threadId={
                            threads.find(t => t.messages.some(m => m.id === report.id))?.id ?? ''
                          }
                          projectId={projectId}
                          onSent={fetchThreads}
                        />
                      )}
                    </div>
                  )
                })}
              <div ref={bottomRef} />
            </div>

            {userRole === 'JRF' && (
              <div className="border-t p-3 space-y-2 bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600">
                    📋 Submit today&apos;s report
                  </span>
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
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage('DAILY_REPORT')
                      }
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
        <button onClick={() => setOpen(true)} className="text-xs text-violet-600 hover:underline">
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
              onClick={() => {
                setOpen(false)
                setText('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}