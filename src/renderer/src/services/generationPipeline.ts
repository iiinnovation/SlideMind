import { streamChat } from '@/services/llmService'
import type {
  ChatMessage,
  ChatMessagePart,
  LLMProvider,
  UIAttachment,
  UIChatMessage
} from '@/types/llm'

export type GenerationMode = 'planning' | 'content'

function getAttachmentTextPayload(att: UIAttachment, mode: GenerationMode): string | undefined {
  if (mode === 'planning') {
    return att.planningSummary || att.contentSummary || att.extractedText
  }
  return att.extractedText || att.contentSummary || att.planningSummary
}

export function hasReferenceAnswerAttachments(attachments?: UIAttachment[]): boolean {
  if (!attachments || attachments.length === 0) return false

  return attachments.some((att) => {
    if (att.fileType === 'image') return false
    const haystack = [
      att.fileName,
      att.classification,
      att.planningSummary,
      att.contentSummary,
      att.extractedText?.slice(0, 300)
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase()

    return /(答案|参考答案|标准答案|answer|key|keys|solution|solutions|解析)/.test(haystack)
  })
}

export function buildUserContent(
  msg: UIChatMessage,
  mode: GenerationMode = 'content'
): string | ChatMessagePart[] {
  const attachments = msg.attachments
  if (!attachments || attachments.length === 0) {
    return msg.content
  }

  const parts: ChatMessagePart[] = []

  for (const att of attachments) {
    if (att.fileType !== 'image') {
      const textPayload = getAttachmentTextPayload(att, mode)
      if (!textPayload) continue
      parts.push({
        type: 'text',
        text: `[附件: ${att.fileName}${att.classification ? ` / ${att.classification}` : ''}]\n${textPayload}`
      })
    }
  }

  if (msg.content) {
    parts.push({ type: 'text', text: msg.content })
  }

  for (const att of attachments) {
    if (att.fileType === 'image' && att.imageDataUrl) {
      parts.push({
        type: 'image_url',
        image_url: { url: att.imageDataUrl }
      })
    }
  }

  if (parts.length === 1 && parts[0].type === 'text') {
    return parts[0].text
  }

  return parts
}

export function buildBaseMessages(
  messages: UIChatMessage[],
  assistantId: string,
  systemPrompt: string,
  mode: GenerationMode = 'content'
): ChatMessage[] {
  const llmMessages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]

  const currentMsg = messages[messages.length - 2]
  const attachments: UIAttachment[] = currentMsg?.attachments ?? []
  const imageAttachments = attachments.filter((a) => a.fileType === 'image' && a.imageDataUrl)
  if (imageAttachments.length > 0) {
    const imageList = imageAttachments
      .map((a, i) => `图片${i + 1}: "${a.fileName}"${a.classification ? ` / ${a.classification}` : ''} (data URI 已在用户消息中提供)`)
      .join('\n')
    llmMessages.push({
      role: 'system',
      content: `用户提供了以下图片，如果适合嵌入课件，可以使用 {"type": "image", "src": "<data URI>", "alt": "描述"} 元素。可用图片：\n${imageList}`
    })
  }

  const documentAttachments = attachments.filter(
    (a) => a.fileType !== 'image' && (a.planningSummary || a.contentSummary || a.extractedText)
  )
  const hasAnswerAttachments = hasReferenceAnswerAttachments(attachments)
  if (documentAttachments.length > 0) {
    const attachmentSummary = documentAttachments
      .map((att, index) => {
        const summary = getAttachmentTextPayload(att, mode)
        return `附件${index + 1}: ${att.fileName}\n${summary}`
      })
      .join('\n\n')
    llmMessages.push({
      role: 'system',
      content: mode === 'planning'
        ? `以下是附件摘要，请优先利用这些信息规划页面结构，不要把整份材料机械塞进单页：\n${attachmentSummary}`
        : `以下是附件摘要，请结合这些信息生成课件内容：\n${attachmentSummary}`
    })
  }

  llmMessages.push({
    role: 'system',
    content: hasAnswerAttachments
      ? '当前附件中包含答案或解析资料。只有在确有对应答案依据时，才允许输出答案、步骤、得分点、作答提醒等答案性内容。'
      : '当前附件中不包含答案或解析资料。禁止编造标准答案、解题步骤、得分点、结论性总结、干扰项分析或作答提醒。选择题页只保留题干和选项；材料题页只保留材料和设问；问答题页只保留题干或题目本身。'
  })

  for (const msg of messages) {
    if (msg.id === assistantId) break
    if (msg.role === 'user') {
      llmMessages.push({ role: 'user', content: buildUserContent(msg, mode) })
    } else if (msg.role === 'assistant' && msg.status === 'complete') {
      llmMessages.push({ role: 'assistant', content: msg.content })
    }
  }

  return llmMessages
}

export async function streamToString(
  provider: LLMProvider,
  apiKey: string,
  messages: ChatMessage[],
  model?: string,
  signal?: AbortSignal
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let raw = ''
    void streamChat(
      provider,
      apiKey,
      messages,
      {
        onChunk(chunk: string) {
          raw += chunk
        },
        onDone() {
          resolve(raw)
        },
        onError(error: Error) {
          reject(error)
        }
      },
      model,
      {
        responseFormat: { type: 'json_object' },
        signal
      }
    )
  })
}
