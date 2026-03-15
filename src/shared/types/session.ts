import type { Slide } from './slide'
import type { AttachmentType } from './attachment'

export interface StoredAttachment {
  id: string
  fileName: string
  fileType: AttachmentType
  thumbnailDataUrl?: string
}

export interface StoredEditorConversation {
  id: string
  title: string
  markdown: string
  slides: Slide[]
  currentScene: string
  currentTheme: string
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
