import { readFile, stat } from 'fs/promises'
import { nativeImage } from 'electron'
import { basename, extname } from 'path'
import type { AttachmentType, FileParseResult, ParsedAttachment } from '../../shared/types/attachment'

const SIZE_LIMITS: Record<AttachmentType, number> = {
  image: 10 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  docx: 10 * 1024 * 1024,
  text: 2 * 1024 * 1024
}

const TEXT_TRUNCATE_LIMIT = 30_000

const EXT_TO_TYPE: Record<string, AttachmentType> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.txt': 'text',
  '.md': 'text'
}

const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown'
}

function createId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text
  return text.slice(0, limit) + '\n...[内容已截断]'
}

async function parseImage(filePath: string): Promise<Pick<ParsedAttachment, 'imageDataUrl' | 'thumbnailDataUrl'>> {
  const img = nativeImage.createFromPath(filePath)
  if (img.isEmpty()) {
    throw new Error('无法读取图片文件')
  }

  // Resize for LLM input (max 1024px wide)
  const size = img.getSize()
  let resized = img
  if (size.width > 1024) {
    resized = img.resize({ width: 1024 })
  }
  const imageDataUrl = `data:image/jpeg;base64,${resized.toJPEG(80).toString('base64')}`

  // Create thumbnail (80px wide)
  const thumb = img.resize({ width: 80 })
  const thumbnailDataUrl = `data:image/jpeg;base64,${thumb.toJPEG(60).toString('base64')}`

  return { imageDataUrl, thumbnailDataUrl }
}

async function parsePdf(filePath: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const fileData = await readFile(filePath)
  const parser = new PDFParse({ data: new Uint8Array(fileData) })
  try {
    const result = await parser.getText()
    return truncateText(result.text, TEXT_TRUNCATE_LIMIT)
  } finally {
    await parser.destroy()
  }
}

async function parseDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ path: filePath })
  return truncateText(result.value, TEXT_TRUNCATE_LIMIT)
}

async function parseTextFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  return truncateText(content, TEXT_TRUNCATE_LIMIT)
}

export async function parseFile(filePath: string): Promise<FileParseResult> {
  try {
    const ext = extname(filePath).toLowerCase()
    const fileType = EXT_TO_TYPE[ext]
    if (!fileType) {
      return { success: false, error: `不支持的文件类型: ${ext}` }
    }

    const fileStat = await stat(filePath)
    const sizeLimit = SIZE_LIMITS[fileType]
    if (fileStat.size > sizeLimit) {
      const limitMB = Math.round(sizeLimit / 1024 / 1024)
      return { success: false, error: `文件大小超过限制（最大 ${limitMB}MB）` }
    }

    const attachment: ParsedAttachment = {
      id: createId(),
      fileName: basename(filePath),
      fileType,
      mimeType: EXT_TO_MIME[ext] || 'application/octet-stream',
      fileSize: fileStat.size
    }

    switch (fileType) {
      case 'image': {
        const imageData = await parseImage(filePath)
        attachment.imageDataUrl = imageData.imageDataUrl
        attachment.thumbnailDataUrl = imageData.thumbnailDataUrl
        break
      }
      case 'pdf': {
        const text = await parsePdf(filePath)
        attachment.extractedText = text
        attachment.textPreview = text.slice(0, 200)
        break
      }
      case 'docx': {
        const text = await parseDocx(filePath)
        attachment.extractedText = text
        attachment.textPreview = text.slice(0, 200)
        break
      }
      case 'text': {
        const text = await parseTextFile(filePath)
        attachment.extractedText = text
        attachment.textPreview = text.slice(0, 200)
        break
      }
    }

    return { success: true, attachment }
  } catch (error) {
    return { success: false, error: `文件解析失败: ${error instanceof Error ? error.message : String(error)}` }
  }
}
