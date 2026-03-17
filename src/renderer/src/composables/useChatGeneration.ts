import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import {
  SCENE_CONFIGS,
  buildContentSystemPrompt,
  buildPlanningSystemPrompt,
  parseSlidePlan,
  reconcileSlidesWithPlan,
  type SlidePlanDocument,
  type SceneType
} from '@/services/promptService'
import { streamChat } from '@/services/llmService'
import { extractCompletedSlides, finalizePresentation } from '@/services/presentationJson'
import { buildBaseMessages, hasReferenceAnswerAttachments, streamToString } from '@/services/generationPipeline'
import { createChunkBatcher } from './useChunkBatcher'
import type { UIAttachment } from '@/types/llm'
import type { Slide } from '../../../shared/types/slide'

const CONTENT_BATCH_SIZE = 4

export function useChatGeneration() {
  const editorStore = useEditorStore()
  const settingsStore = useSettingsStore()
  let currentAbortController: AbortController | null = null

  async function generate(userInput: string, attachments?: UIAttachment[]) {
    if (editorStore.isGenerating) return

    currentAbortController = new AbortController()
    const apiKey = settingsStore.apiKeys[settingsStore.currentProvider]
    if (!apiKey) {
      alert('请先在设置中配置 API Key')
      return
    }

    const conversationId = editorStore.activeConversationId
    editorStore.setGenerating(true, conversationId ?? undefined)
    editorStore.resetLlmDebug(conversationId ?? undefined)
    editorStore.addUserMessage(userInput, attachments, conversationId ?? undefined)
    const assistantId = editorStore.addAssistantMessage(conversationId ?? undefined)

    const scene = editorStore.currentScene as SceneType
    const sceneConfig = SCENE_CONFIGS[scene]
    const themeName = sceneConfig?.theme || editorStore.currentTheme

    let planningRaw = ''
    let planDocument: SlidePlanDocument | null = null
    const allowAnswerBasedContent = hasReferenceAnswerAttachments(attachments)
    const accumulatedSlides: Slide[] = []

    try {
      editorStore.setAssistantMessageContent(
        assistantId,
        '正在规划课件页面结构...',
        conversationId ?? undefined
      )

      const planningMessages = buildBaseMessages(
        editorStore.messages,
        assistantId,
        buildPlanningSystemPrompt(scene),
        'planning'
      )
      planningRaw = await streamToString(
        settingsStore.currentProvider,
        apiKey,
        planningMessages,
        settingsStore.currentModel,
        currentAbortController.signal
      )
      editorStore.setPlanningDebugRaw(planningRaw, conversationId ?? undefined)

      planDocument = parseSlidePlan(planningRaw, themeName)
      if (!planDocument) {
        throw new Error('页面规划生成失败')
      }

      editorStore.setAssistantMessageContent(
        assistantId,
        '页面规划完成，正在生成课件内容...',
        conversationId ?? undefined
      )

      const contentPlans = chunkPlanDocument(planDocument, CONTENT_BATCH_SIZE)

      for (let batchIndex = 0; batchIndex < contentPlans.length; batchIndex += 1) {
        const currentPlan = contentPlans[batchIndex]
        const progressLabel = contentPlans.length > 1
          ? `页面规划完成，正在生成课件内容（${batchIndex + 1}/${contentPlans.length}）...`
          : '页面规划完成，正在生成课件内容...'

        editorStore.setAssistantMessageContent(
          assistantId,
          progressLabel,
          conversationId ?? undefined
        )

        const batchSlides = await generateContentBatch({
          scene,
          planDocument: currentPlan,
          assistantId,
          apiKey,
          allowAnswerBasedContent,
          batchIndex,
          batchLabel: progressLabel,
          conversationId: conversationId ?? undefined,
          onProgress(slides) {
            editorStore.setSlides([...accumulatedSlides, ...slides], conversationId ?? undefined)
          },
          signal: currentAbortController.signal
        })

        accumulatedSlides.push(...batchSlides)
        editorStore.setSlides(accumulatedSlides.slice(), conversationId ?? undefined)
      }

      if (accumulatedSlides.length === 0) {
        editorStore.setAssistantMessageContent(
          assistantId,
          '课件生成失败：未解析出有效页面。',
          conversationId ?? undefined
        )
        editorStore.setMessageStatus(assistantId, 'error', conversationId ?? undefined)
        editorStore.setGenerating(false, conversationId ?? undefined)
        currentAbortController = null
        return
      }

      const finalContent = JSON.stringify(
        {
          theme: themeName,
          slides: accumulatedSlides
        },
        null,
        2
      )
      editorStore.setAssistantMessageContent(
        assistantId,
        finalContent,
        conversationId ?? undefined
      )
      editorStore.setMessageStatus(assistantId, 'complete', conversationId ?? undefined)
      editorStore.setGenerating(false, conversationId ?? undefined)
      currentAbortController = null
    } catch (error) {
      console.error('Generation error:', error)
      if (error instanceof Error && error.message === '请求已取消') {
        editorStore.setAssistantMessageContent(
          assistantId,
          '已停止本次生成。',
          conversationId ?? undefined
        )
        editorStore.setMessageStatus(assistantId, 'complete', conversationId ?? undefined)
        editorStore.setGenerating(false, conversationId ?? undefined)
        currentAbortController = null
        return
      }
      editorStore.setMessageStatus(assistantId, 'error', conversationId ?? undefined)
      editorStore.setGenerating(false, conversationId ?? undefined)
      currentAbortController = null
    }
  }

  function stopGeneration() {
    if (!currentAbortController) return
    currentAbortController.abort()
    currentAbortController = null
  }

  return { generate, stopGeneration }
}

function chunkPlanDocument(planDocument: SlidePlanDocument, size: number): SlidePlanDocument[] {
  const batches: SlidePlanDocument[] = []

  for (let index = 0; index < planDocument.plan.length; index += size) {
    batches.push({
      ...planDocument,
      plan: planDocument.plan.slice(index, index + size)
    })
  }

  return batches
}

async function generateContentBatch(params: {
  scene: SceneType
  planDocument: SlidePlanDocument
  assistantId: string
  apiKey: string
  allowAnswerBasedContent: boolean
  batchIndex: number
  batchLabel: string
  conversationId?: string
  onProgress: (slides: Slide[]) => void
  signal: AbortSignal
}): Promise<Slide[]> {
  const editorStore = useEditorStore()
  const settingsStore = useSettingsStore()
  let rawContent = ''
  let lastSlideCount = 0

  const llmMessages = buildBaseMessages(
    editorStore.messages,
    params.assistantId,
    buildContentSystemPrompt(params.scene, params.planDocument),
    'content'
  )

  const batcher = createChunkBatcher((accumulated: string) => {
    rawContent += accumulated
    editorStore.setContentBatchDebugRaw(
      params.batchIndex,
      params.batchLabel,
      rawContent,
      params.conversationId
    )

    const extractedSlides = extractCompletedSlides(rawContent)
    const slides = reconcileSlidesWithPlan(extractedSlides, {
      ...params.planDocument,
      plan: params.planDocument.plan.slice(0, extractedSlides.length)
    })
    const sanitizedSlides = sanitizeGeneratedSlides(slides, params.allowAnswerBasedContent)
    if (sanitizedSlides.length > 0 && sanitizedSlides.length !== lastSlideCount) {
      lastSlideCount = sanitizedSlides.length
      params.onProgress(sanitizedSlides)
    }
  })

  try {
    await new Promise<void>((resolve, reject) => {
      void streamChat(settingsStore.currentProvider, params.apiKey, llmMessages, {
        onChunk(chunk: string) {
          batcher.push(chunk)
        },
        onDone() {
          batcher.flush()
          resolve()
        },
        onError(error: Error) {
          batcher.destroy()
          reject(error)
        }
      }, settingsStore.currentModel, {
        signal: params.signal,
        responseFormat: { type: 'json_object' }
      })
    })
  } catch (error) {
    batcher.destroy()
    throw error
  }

  batcher.destroy()
  editorStore.setContentBatchDebugRaw(
    params.batchIndex,
    params.batchLabel,
    rawContent,
    params.conversationId
  )

  const presentation = finalizePresentation(rawContent, params.planDocument.theme)
  const extractedSlides = extractCompletedSlides(rawContent)
  const resolvedSlides = presentation.slides.length > 0
    ? reconcileSlidesWithPlan(presentation.slides, {
        ...params.planDocument,
        plan: params.planDocument.plan.slice(0, presentation.slides.length)
      })
    : extractedSlides.length > 0
      ? reconcileSlidesWithPlan(extractedSlides, {
          ...params.planDocument,
          plan: params.planDocument.plan.slice(0, extractedSlides.length)
        })
      : []

  return sanitizeGeneratedSlides(resolvedSlides, params.allowAnswerBasedContent)
}

function sanitizeGeneratedSlides(slides: Slide[], allowAnswerBasedContent: boolean): Slide[] {
  return slides.map((slide) => {
    const cleanedElements = slide.elements.flatMap((element) => {
      if (element.type === 'list') {
        const items = element.items.filter((item) => !isPlaceholderText(item))
        if (items.length === 0) return []
        return [{ ...element, items }]
      }

      if (element.type === 'text' || element.type === 'heading' || element.type === 'blockquote') {
        return isPlaceholderText(element.content) ? [] : [element]
      }

      return [element]
    })

    if (allowAnswerBasedContent) {
      return {
        ...slide,
        elements: cleanedElements
      }
    }

    if (
      slide.kind === 'question-choice' ||
      slide.kind === 'question-material' ||
      slide.kind === 'question-answer'
    ) {
      return {
        ...slide,
        elements: cleanedElements.filter((element) => element.region !== 'answer' && element.region !== 'tips')
      }
    }

    return {
      ...slide,
      elements: cleanedElements
    }
  })
}

function isPlaceholderText(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').trim()
  if (!normalized) return true

  if (
    /(题干缺失|根据规划保留页面|请补充|占位|待补充|暂无内容|内容缺失)/.test(normalized)
  ) {
    return true
  }

  return /^(?:[A-D][.．、])?选项[一二三四1234ABCD]$/.test(normalized)
}
