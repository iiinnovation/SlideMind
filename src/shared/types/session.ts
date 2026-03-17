import type { Slide } from './slide'
import type { AttachmentType } from './attachment'

export interface StoredAttachment {
  id: string
  fileName: string
  fileType: AttachmentType
  thumbnailDataUrl?: string
  extractedText?: string
  planningSummary?: string
  contentSummary?: string
  classification?: string
  imageDataUrl?: string
}

export interface StoredEditorConversation {
  id: string
  title: string
  markdown: string
  slides: Slide[]
  currentScene: string
  currentTheme: string
  llmDebug?: {
    planningRaw: string
    contentBatches: Array<{
      label: string
      raw: string
    }>
  }
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    status: 'complete' | 'streaming' | 'error'
    attachments?: StoredAttachment[]
  }>
  createdAt: number
  updatedAt: number
}

export interface EditorStateSnapshot {
  conversations: StoredEditorConversation[]
  activeConversationId: string | null
}
