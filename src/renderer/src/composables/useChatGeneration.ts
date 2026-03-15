import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { SCENE_CONFIGS, type SceneType } from '@/services/promptService'
import { streamChat } from '@/services/llmService'
import { extractCompletedSlides, finalizePresentation } from '@/services/presentationJson'
import { createChunkBatcher } from './useChunkBatcher'
import type { ChatMessage, ChatMessagePart, UIChatMessage, UIAttachment } from '@/types/llm'

function buildUserContent(msg: UIChatMessage): string | ChatMessagePart[] {
  const attachments = msg.attachments
  if (!attachments || attachments.length === 0) {
    return msg.content
  }

  const parts: ChatMessagePart[] = []

  // Add document attachments as text
  for (const att of attachments) {
    if (att.fileType !== 'image' && att.extractedText) {
      parts.push({
        type: 'text',
        text: `[附件: ${att.fileName}]\n${att.extractedText}`
      })
    }
  }

  // Add user text
  if (msg.content) {
    parts.push({ type: 'text', text: msg.content })
  }

  // Add image attachments
  for (const att of attachments) {
    if (att.fileType === 'image' && att.imageDataUrl) {
      parts.push({
        type: 'image_url',
        image_url: { url: att.imageDataUrl }
      })
    }
  }

  // Optimize: if only one text part, return plain string
  if (parts.length === 1 && parts[0].type === 'text') {
    return parts[0].text
  }

  return parts
}

export function useChatGeneration() {
  const editorStore = useEditorStore()
  const settingsStore = useSettingsStore()

  async function generate(userInput: string, attachments?: UIAttachment[]) {
    if (editorStore.isGenerating) return

    const apiKey = settingsStore.apiKeys[settingsStore.currentProvider]
    if (!apiKey) {
      alert('请先在设置中配置 API Key')
      return
    }

    const conversationId = editorStore.activeConversationId
    editorStore.setGenerating(true, conversationId ?? undefined)
    editorStore.addUserMessage(userInput, attachments, conversationId ?? undefined)
    const assistantId = editorStore.addAssistantMessage(conversationId ?? undefined)

    const scene = editorStore.currentScene as SceneType
    const sceneConfig = SCENE_CONFIGS[scene]
    const systemPrompt = sceneConfig?.systemPrompt || ''
    const themeName = sceneConfig?.theme || editorStore.currentTheme

    // Build message history for LLM
    const llmMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Check if current message has image attachments for slide embedding
    const currentMsg = editorStore.messages[editorStore.messages.length - 2]
    const imageAttachments = currentMsg?.attachments?.filter(
      (a) => a.fileType === 'image' && a.imageDataUrl
    )
    if (imageAttachments && imageAttachments.length > 0) {
      const imageList = imageAttachments
        .map((a, i) => `图片${i + 1}: "${a.fileName}" (data URI 已在用户消息中提供)`)
        .join('\n')
      llmMessages.push({
        role: 'system',
        content: `用户提供了以下图片，如果适合嵌入课件，可以使用 {"type": "image", "src": "<data URI>", "alt": "描述"} 元素。可用图片：\n${imageList}`
      })
    }

    // Include previous conversation for context
    for (const msg of editorStore.messages) {
      if (msg.id === assistantId) break
      if (msg.role === 'user') {
        llmMessages.push({ role: 'user', content: buildUserContent(msg) })
      } else if (msg.role === 'assistant' && msg.status === 'complete') {
        llmMessages.push({ role: 'assistant', content: msg.content })
      }
    }

    let rawContent = ''
    let lastSlideCount = 0

    const batcher = createChunkBatcher((accumulated: string) => {
      rawContent += accumulated

      // Incrementally extract completed slides
      const slides = extractCompletedSlides(rawContent)
      if (slides.length > 0 && slides.length !== lastSlideCount) {
        lastSlideCount = slides.length
        editorStore.setSlides(slides, conversationId ?? undefined)
      }
    })

    try {
      await streamChat(settingsStore.currentProvider, apiKey, llmMessages, {
        onChunk(chunk: string) {
          batcher.push(chunk)
        },
        onDone() {
          batcher.flush()
          const presentation = finalizePresentation(rawContent, themeName)
          editorStore.setSlides(presentation.slides, conversationId ?? undefined)
          editorStore.setAssistantMessageContent(
            assistantId,
            rawContent,
            conversationId ?? undefined
          )
          editorStore.setMessageStatus(assistantId, 'complete', conversationId ?? undefined)
          editorStore.setGenerating(false, conversationId ?? undefined)
        },
        onError(error: Error) {
          batcher.destroy()
          console.error('Generation error:', error)
          editorStore.setMessageStatus(assistantId, 'error', conversationId ?? undefined)
          editorStore.setGenerating(false, conversationId ?? undefined)
        }
      }, settingsStore.currentModel, {
        responseFormat: { type: 'json_object' }
      })
    } catch (error) {
      batcher.destroy()
      console.error('Generation error:', error)
      editorStore.setMessageStatus(assistantId, 'error', conversationId ?? undefined)
      editorStore.setGenerating(false, conversationId ?? undefined)
    }
  }

  return { generate }
}
