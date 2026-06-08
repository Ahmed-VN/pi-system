import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const template = await prisma.anrfTemplate.findUnique({
      where: { id: parseInt(id) },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const absolutePath = path.join(process.cwd(), 'public', template.filePath)
    const fileBuffer = await readFile(absolutePath)

    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      other: 'application/octet-stream',
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentTypeMap[template.fileType] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${template.originalName}"`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}