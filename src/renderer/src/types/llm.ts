import type { Slide } from '../../../shared/types/slide'
import type { AttachmentType } from '../../../shared/types/attachment'

export type LLMProvider = 'deepseek' | 'doubao' | 'qianwen'

export interface LLMConfig {
  name: string
  baseUrl: string
  defaultModel: string
  models: string[]
}

export const LLM_CONFIGS: Record<LLMProvider, LLMConfig> = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  doubao: {
    name: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    models: ['doubao-pro-32k', 'doubao-pro-128k']
  },
  qianwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max']
  }
}

export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatMessagePart[]
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

export interface StreamChatOptions {
  signal?: AbortSignal
  responseFormat?: { type: 'json_object' | 'text' }
}

export interface UIAttachment {
  id: string
  fileName: string
  fileType: AttachmentType
  thumbnailDataUrl?: string
  extractedText?: string
  imageDataUrl?: string
}

export interface UIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  status: 'complete' | 'streaming' | 'error'
  attachments?: UIAttachment[]
}

export interface EditorConversation {
  id: string
  title: string
  markdown: string
  slides: Slide[]
  currentScene: string
  currentTheme: string
  messages: UIChatMessage[]
  isGenerating: boolean
  createdAt: number
  updatedAt: number
}
