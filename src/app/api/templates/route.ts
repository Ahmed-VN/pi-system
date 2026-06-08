import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileType(filename: string): 'pdf' | 'docx' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'doc' || ext === 'docx') return 'docx'
  return 'other'
}

// GET /api/templates — list all templates
export async function GET() {
  try {
    const templates = await prisma.anrfTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { name: true } } },
    })

    return NextResponse.json({
      templates: templates.map((t: {
        id: number
        name: string
        originalName: string
        category: string
        fileType: string
        fileSize: string
        createdAt: Date
        uploadedBy: { name: string | null }
      }) => ({
        id: t.id,
        name: t.name,
        originalName: t.originalName,
        category: t.category,
        fileType: t.fileType,
        fileSize: t.fileSize,
        uploadedAt: t.createdAt.toISOString(),
        uploadedBy: t.uploadedBy.name ?? 'Unknown',
        url: `/api/templates/${t.id}/download`,
      })),
    })
  } catch (error) {
    console.error('GET /api/templates error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/templates — upload a new template
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string
    const category = formData.get('category') as string

    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save to /public/templates/
    const uploadDir = path.join(process.cwd(), 'public', 'templates')
    await mkdir(uploadDir, { recursive: true })

    const timestamp = Date.now()
    const safeFilename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(uploadDir, safeFilename)
    await writeFile(filePath, buffer)

    const template = await prisma.anrfTemplate.create({
      data: {
        name,
        originalName: file.name,
        category: category || 'Other',
        fileType: getFileType(file.name),
        fileSize: formatBytes(file.size),
        filePath: `/templates/${safeFilename}`,
        uploadedById: session.user.id,
      },
    })

    return NextResponse.json({ success: true, id: template.id })
  } catch (error) {
    console.error('POST /api/templates error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}