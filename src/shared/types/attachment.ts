export type AttachmentType = 'image' | 'pdf' | 'docx' | 'text'

export interface ParsedAttachment {
  id: string
  fileName: string
  fileType: AttachmentType
  mimeType: string
  fileSize: number
  extractedText?: string
  textPreview?: string
  planningSummary?: string
  contentSummary?: string
  classification?: string
  imageDataUrl?: string
  thumbnailDataUrl?: string
}

export interface FileParseResult {
  success: boolean
  error?: string
  attachment?: ParsedAttachment
}
