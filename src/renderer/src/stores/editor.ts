import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { EditorConversation, UIChatMessage, UIAttachment, LLMGenerationDebug } from '@/types/llm'
import { EXPORT_LAYOUT_LIMITS } from '../../../shared/constants'
import { getSlideTemplate } from '../../../shared/templates'
import type { Slide, SlideElement, SlideKind, SlideLayout } from '../../../shared/types/slide'
import type { EditorStateSnapshot, StoredEditorConversation, StoredAttachment } from '../../../shared/types/session'

const MAX_PERSISTED_CONVERSATIONS = 30
const CONTENT_PERSIST_DEBOUNCE_MS = 2000
const STRUCTURE_PERSIST_DEBOUNCE_MS = 400

function createEmptyLlmDebug(): LLMGenerationDebug {
  return {
    planningRaw: '',
    contentBatches: []
  }
}

export const useEditorStore = defineStore('editor', () => {
  const conversations = ref<EditorConversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const isReady = ref(false)
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  function createMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function cloneSlide(slide: Slide): Slide {
    return JSON.parse(JSON.stringify(slide)) as Slide
  }

  function createEmptySlide(kind: SlideKind = 'knowledge-points'): Slide {
    const layout: SlideLayout = kind === 'cover'
      ? 'title'
      : kind === 'summary'
        ? 'summary'
        : 'content'
    const elements: SlideElement[] = kind === 'summary'
      ? [{ type: 'list', region: 'summary', items: ['总结要点'] }]
      : [{ type: 'list', region: kind === 'question-answer' ? 'question' : 'body', items: ['请编辑此页内容'] }]

    return {
      layout,
      kind,
      title: kind === 'summary' ? '总结' : '新页面',
      subtitle: layout === 'title' ? '请补充副标题' : undefined,
      elements
    }
  }

  function inferLayoutFromKind(kind: SlideKind): SlideLayout {
    if (kind === 'cover') return 'title'
    if (kind === 'summary') return 'summary'
    return 'content'
  }

  function createStructuredPlaceholder(region: 'question' | 'options' | 'material' | 'analysis' | 'answer' | 'tips'): SlideElement {
    switch (region) {
      case 'options':
        return { type: 'list', region, items: ['选项 A', '选项 B'] }
      case 'answer':
        return { type: 'list', region, items: ['请补充标准答案'] }
      case 'tips':
        return { type: 'list', region, items: ['请补充提醒要点'] }
      case 'material':
        return { type: 'text', region, content: '请补充材料背景' }
      case 'analysis':
        return { type: 'list', region, items: ['请补充解析步骤'] }
      case 'question':
        return { type: 'text', region, content: '请补充题干内容' }
    }
  }

  function buildContinuationTitle(title?: string, index = 2): string {
    const baseTitle = (title ?? '新页面').replace(/\s*[（(]续(?:页)?\s*\d*[）)]\s*$/u, '').trim()
    return `${baseTitle}（续 ${index}）`
  }

  function splitElementsIntoChunks(slide: Slide): SlideElement[][] {
    if (slide.elements.length <= 1) return [slide.elements.slice()]

    if (
      slide.kind &&
      ['question-answer', 'question-choice', 'question-material'].includes(slide.kind)
    ) {
      const regionOrder = EXPORT_LAYOUT_LIMITS.structuredRegionPriority[slide.kind]
      const groups = regionOrder
        .map((region) => slide.elements.filter((element) => element.region === region))
        .filter((group) => group.length > 0)
      const leftovers = slide.elements.filter((element) =>
        !element.region || !regionOrder.includes(element.region)
      )

      if (groups.length >= 2) {
        const midpoint = Math.ceil(groups.length / 2)
        const chunks = [
          groups.slice(0, midpoint).flat(),
          groups.slice(midpoint).flat()
        ]
        if (leftovers.length > 0) {
          chunks[chunks.length - 1].push(...leftovers)
        }
        return chunks.filter((chunk) => chunk.length > 0)
      }
    }

    const midpoint = Math.ceil(slide.elements.length / 2)
    return [
      slide.elements.slice(0, midpoint),
      slide.elements.slice(midpoint)
    ].filter((chunk) => chunk.length > 0)
  }

  function standardizeSlideWithTemplate(slide: Slide, templateId: string): Slide {
    const template = getSlideTemplate(templateId)
    if (!template) return slide

    const primaryRegion = template.regions[0] ?? 'body'
    const normalizedElements = slide.elements.length > 0
      ? slide.elements.map((element) => ({
        ...element,
        region: element.region && template.regions.includes(element.region)
          ? element.region
          : primaryRegion
      }))
      : [{
        ...createEmptyElement(template.preferredElementTypes[0] ?? 'text'),
        region: primaryRegion
      }]

    return {
      ...slide,
      layout: template.layout,
      kind: template.kind,
      templateId: template.id,
      elements: normalizedElements
    }
  }

  function createConversationTitle(index: number) {
    return `新对话 ${index}`
  }

  function findConversation(conversationId: string | null | undefined) {
    if (!conversationId) return null
    return conversations.value.find((item) => item.id === conversationId) ?? null
  }

  function pruneConversations() {
    if (conversations.value.length <= MAX_PERSISTED_CONVERSATIONS) return
    conversations.value = conversations.value.slice(0, MAX_PERSISTED_CONVERSATIONS)
    if (!conversations.value.some((item) => item.id === activeConversationId.value)) {
      activeConversationId.value = conversations.value[0]?.id ?? null
    }
  }

  function toStoredConversation(conversation: EditorConversation): StoredEditorConversation {
    return {
      id: conversation.id,
      title: conversation.title,
      markdown: conversation.markdown,
      slides: conversation.slides,
      currentScene: conversation.currentScene,
      currentTheme: conversation.currentTheme,
      llmDebug: {
        planningRaw: conversation.llmDebug.planningRaw,
        contentBatches: conversation.llmDebug.contentBatches.map((batch) => ({ ...batch }))
      },
      messages: conversation.messages.map((msg) => {
        const stored: StoredEditorConversation['messages'][number] = {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          status: msg.status
        }
        if (msg.attachments && msg.attachments.length > 0) {
          stored.attachments = msg.attachments.map((att): StoredAttachment => ({
            id: att.id,
            fileName: att.fileName,
            fileType: att.fileType,
            thumbnailDataUrl: att.thumbnailDataUrl,
            extractedText: att.extractedText,
            planningSummary: att.planningSummary,
            contentSummary: att.contentSummary,
            classification: att.classification,
            imageDataUrl: att.imageDataUrl
          }))
        }
        return stored
      }),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }
  }

  function createSnapshot(): EditorStateSnapshot {
    return {
      conversations: conversations.value
        .slice(0, MAX_PERSISTED_CONVERSATIONS)
        .map(toStoredConversation),
      activeConversationId: activeConversationId.value
    }
  }

  function schedulePersist(delay = CONTENT_PERSIST_DEBOUNCE_MS) {
    if (!isReady.value || !window.api) return
    if (persistTimer) {
      clearTimeout(persistTimer)
    }
    persistTimer = setTimeout(() => {
      persistTimer = null
      void window.api.saveEditorState(createSnapshot())
    }, delay)
  }

  function hydrateConversation(conversation: StoredEditorConversation): EditorConversation {
    return {
      ...conversation,
      slides: Array.isArray(conversation.slides) ? conversation.slides : [],
      llmDebug: {
        planningRaw: conversation.llmDebug?.planningRaw ?? '',
        contentBatches: Array.isArray(conversation.llmDebug?.contentBatches)
          ? conversation.llmDebug!.contentBatches.map((batch) => ({ ...batch }))
          : []
      },
      isGenerating: false
    }
  }

  async function initialize() {
    if (isReady.value) return

    const snapshot = window.api
      ? await window.api.loadEditorState()
      : { conversations: [], activeConversationId: null }

    conversations.value = Array.isArray(snapshot.conversations)
      ? snapshot.conversations.map(hydrateConversation)
      : []
    activeConversationId.value = snapshot.activeConversationId

    if (conversations.value.length === 0) {
      createConversation()
    } else if (!conversations.value.some((item) => item.id === activeConversationId.value)) {
      activeConversationId.value = conversations.value[0].id
    }

    pruneConversations()
    isReady.value = true
    schedulePersist(STRUCTURE_PERSIST_DEBOUNCE_MS)
  }

  function getActiveConversation() {
    const conversation = findConversation(activeConversationId.value)
    if (!conversation) {
      const id = createConversation()
      return conversations.value.find((item) => item.id === id)!
    }
    return conversation
  }

  function touchConversation(
    conversation: EditorConversation,
    options: { bump?: boolean; persistDelay?: number } = {}
  ) {
    const { bump = false, persistDelay = CONTENT_PERSIST_DEBOUNCE_MS } = options
    conversation.updatedAt = Date.now()
    if (bump) {
      conversations.value = [
        conversation,
        ...conversations.value.filter((item) => item.id !== conversation.id)
      ]
    }
    pruneConversations()
    schedulePersist(persistDelay)
  }

  function refreshConversationTitle(conversation: EditorConversation) {
    const firstUserMessage = conversation.messages.find((message) => message.role === 'user')
    if (!firstUserMessage) return

    let title = firstUserMessage.content.trim().slice(0, 18)
    if (!title && firstUserMessage.attachments?.length) {
      title = firstUserMessage.attachments[0].fileName.slice(0, 18)
    }
    if (title) {
      conversation.title = title
    }
  }

  const activeConversation = computed(() => getActiveConversation())
  const markdown = computed(() => activeConversation.value.markdown)
  const slides = computed(() => activeConversation.value.slides)
  const currentScene = computed(() => activeConversation.value.currentScene)
  const currentTheme = computed(() => activeConversation.value.currentTheme)
  const messages = computed(() => activeConversation.value.messages)
  const isGenerating = computed(() => activeConversation.value.isGenerating)
  const isAnyConversationGenerating = computed(() =>
    conversations.value.some((conversation) => conversation.isGenerating)
  )
  const hasContent = computed(() => {
    const conversation = activeConversation.value
    return conversation.slides.length > 0 || conversation.markdown.length > 0 || conversation.messages.length > 0
  })

  function createConversation(overrides: Partial<EditorConversation> = {}) {
    if (isAnyConversationGenerating.value) {
      return activeConversationId.value ?? getActiveConversation().id
    }

    const now = Date.now()
    const conversation: EditorConversation = {
      id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
      title: createConversationTitle(conversations.value.length + 1),
      markdown: '',
      slides: [],
      currentScene: 'new-lesson',
      currentTheme: 'new-lesson',
      messages: [],
      llmDebug: createEmptyLlmDebug(),
      isGenerating: false,
      createdAt: now,
      updatedAt: now,
      ...overrides
    }

    conversations.value = [conversation, ...conversations.value]
    activeConversationId.value = conversation.id
    pruneConversations()
    schedulePersist(STRUCTURE_PERSIST_DEBOUNCE_MS)
    return conversation.id
  }

  function switchConversation(conversationId: string) {
    if (isAnyConversationGenerating.value) return
    if (activeConversationId.value === conversationId) return
    activeConversationId.value = conversationId
    schedulePersist(STRUCTURE_PERSIST_DEBOUNCE_MS)
  }

  function renameConversation(conversationId: string, title: string) {
    if (isAnyConversationGenerating.value) return
    const conversation = findConversation(conversationId)
    if (!conversation) return

    const nextTitle = title.trim().slice(0, 40)
    if (!nextTitle) return

    conversation.title = nextTitle
    touchConversation(conversation, {
      bump: true,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function deleteConversation(conversationId: string) {
    if (isAnyConversationGenerating.value) return
    if (conversations.value.length <= 1) return

    const nextConversations = conversations.value.filter((item) => item.id !== conversationId)
    if (nextConversations.length === conversations.value.length) return

    conversations.value = nextConversations
    if (activeConversationId.value === conversationId) {
      activeConversationId.value = nextConversations[0]?.id ?? null
    }
    schedulePersist(STRUCTURE_PERSIST_DEBOUNCE_MS)
  }

  function setMarkdown(value: string, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    conversation.markdown = value
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function setSlides(value: Slide[], conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    conversation.slides = value
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function updateSlide(
    slideIndex: number,
    updater: (slide: Slide) => Slide,
    conversationId?: string
  ) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    if (slideIndex < 0 || slideIndex >= conversation.slides.length) return

    const nextSlides = conversation.slides.map((slide, index) =>
      index === slideIndex ? updater(cloneSlide(slide)) : slide
    )
    conversation.slides = nextSlides
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function updateSlideField(
    slideIndex: number,
    field: 'title' | 'subtitle',
    value: string,
    conversationId?: string
  ) {
    updateSlide(slideIndex, (slide) => ({
      ...slide,
      [field]: value.trim() ? value : undefined
    }), conversationId)
  }

  function updateElement(
    slideIndex: number,
    elementIndex: number,
    updater: (element: SlideElement) => SlideElement,
    conversationId?: string
  ) {
    updateSlide(slideIndex, (slide) => {
      if (elementIndex < 0 || elementIndex >= slide.elements.length) return slide
      const elements = slide.elements.map((element, index) =>
        index === elementIndex ? updater(JSON.parse(JSON.stringify(element)) as SlideElement) : element
      )
      return { ...slide, elements }
    }, conversationId)
  }

  function createEmptyElement(type: SlideElement['type']): SlideElement {
    switch (type) {
      case 'heading':
        return { type: 'heading', level: 3, region: 'body', content: '新小标题' }
      case 'text':
        return { type: 'text', region: 'body', content: '请编辑正文内容' }
      case 'list':
        return { type: 'list', region: 'body', items: ['第一条', '第二条'] }
      case 'blockquote':
        return { type: 'blockquote', region: 'body', content: '请编辑引用内容' }
      case 'table':
        return {
          type: 'table',
          region: 'body',
          headers: ['列一', '列二'],
          rows: [['内容 A', '内容 B']]
        }
      case 'image':
        return {
          type: 'image',
          region: 'body',
          src: '',
          alt: '图片说明'
        }
    }
  }

  function insertElement(
    slideIndex: number,
    type: SlideElement['type'],
    index?: number,
    conversationId?: string
  ) {
    updateSlide(slideIndex, (slide) => {
      const element = createEmptyElement(type)
      const insertAt = typeof index === 'number'
        ? Math.min(Math.max(index, 0), slide.elements.length)
        : slide.elements.length
      return {
        ...slide,
        elements: [
          ...slide.elements.slice(0, insertAt),
          element,
          ...slide.elements.slice(insertAt)
        ]
      }
    }, conversationId)
  }

  function deleteElement(slideIndex: number, elementIndex: number, conversationId?: string) {
    updateSlide(slideIndex, (slide) => {
      if (elementIndex < 0 || elementIndex >= slide.elements.length) return slide
      return {
        ...slide,
        elements: slide.elements.filter((_, index) => index !== elementIndex)
      }
    }, conversationId)
  }

  function deleteElementAtPositionFromSlides(
    slideIndices: number[],
    elementIndex: number,
    conversationId?: string
  ) {
    if (elementIndex < 0 || slideIndices.length === 0) return
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const targets = new Set(slideIndices)
    conversation.slides = conversation.slides.map((slide, index) => {
      if (!targets.has(index) || elementIndex >= slide.elements.length) {
        return slide
      }
      return {
        ...slide,
        elements: slide.elements.filter((_, currentIndex) => currentIndex !== elementIndex)
      }
    })
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function deleteRegionFromSlides(
    slideIndices: number[],
    region: SlideRegion,
    conversationId?: string
  ) {
    if (slideIndices.length === 0) return
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const targets = new Set(slideIndices)
    conversation.slides = conversation.slides.map((slide, index) => {
      if (!targets.has(index)) {
        return slide
      }
      return {
        ...slide,
        elements: slide.elements.filter((element) => element.region !== region)
      }
    })
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function moveElement(
    slideIndex: number,
    elementIndex: number,
    direction: 'up' | 'down',
    conversationId?: string
  ) {
    updateSlide(slideIndex, (slide) => {
      const targetIndex = direction === 'up' ? elementIndex - 1 : elementIndex + 1
      if (
        elementIndex < 0 ||
        elementIndex >= slide.elements.length ||
        targetIndex < 0 ||
        targetIndex >= slide.elements.length
      ) {
        return slide
      }

      const elements = slide.elements.slice()
      const [element] = elements.splice(elementIndex, 1)
      elements.splice(targetIndex, 0, element)
      return { ...slide, elements }
    }, conversationId)
  }

  function deleteSlide(slideIndex: number, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    if (slideIndex < 0 || slideIndex >= conversation.slides.length) return
    conversation.slides = conversation.slides.filter((_, index) => index !== slideIndex)
    touchConversation(conversation, {
      bump: false,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function duplicateSlide(slideIndex: number, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const source = conversation.slides[slideIndex]
    if (!source) return
    const clone = cloneSlide(source)
    conversation.slides = [
      ...conversation.slides.slice(0, slideIndex + 1),
      clone,
      ...conversation.slides.slice(slideIndex + 1)
    ]
    touchConversation(conversation, {
      bump: false,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function moveSlide(slideIndex: number, direction: 'up' | 'down', conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const targetIndex = direction === 'up' ? slideIndex - 1 : slideIndex + 1
    if (
      slideIndex < 0 ||
      slideIndex >= conversation.slides.length ||
      targetIndex < 0 ||
      targetIndex >= conversation.slides.length
    ) {
      return
    }

    const nextSlides = conversation.slides.slice()
    const [slide] = nextSlides.splice(slideIndex, 1)
    nextSlides.splice(targetIndex, 0, slide)
    conversation.slides = nextSlides
    touchConversation(conversation, {
      bump: false,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function insertSlide(kind: SlideKind = 'knowledge-points', index?: number, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const nextSlide = createEmptySlide(kind)
    const insertAt = typeof index === 'number'
      ? Math.min(Math.max(index, 0), conversation.slides.length)
      : conversation.slides.length
    conversation.slides = [
      ...conversation.slides.slice(0, insertAt),
      nextSlide,
      ...conversation.slides.slice(insertAt)
    ]
    touchConversation(conversation, {
      bump: false,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function splitSlide(slideIndex: number, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const slide = conversation.slides[slideIndex]
    if (!slide || slide.elements.length <= 1) return

    const chunks = splitElementsIntoChunks(slide)
    if (chunks.length <= 1) return

    const nextSlides = conversation.slides.slice()
    const replacements = chunks.map((elements, chunkIndex) => ({
      ...cloneSlide(slide),
      title: chunkIndex === 0 ? slide.title : buildContinuationTitle(slide.title, chunkIndex + 1),
      elements
    }))

    nextSlides.splice(slideIndex, 1, ...replacements)
    conversation.slides = nextSlides
    touchConversation(conversation, {
      bump: false,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function mergeSlideWithNext(slideIndex: number, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const current = conversation.slides[slideIndex]
    const next = conversation.slides[slideIndex + 1]
    if (!current || !next) return
    if (!canMergeSlides(current, next)) return

    const merged: Slide = {
      ...cloneSlide(current),
      title: current.title ?? next.title,
      subtitle: current.subtitle ?? next.subtitle,
      templateId: current.templateId === next.templateId ? current.templateId : undefined,
      elements: [
        ...cloneSlide(current).elements,
        ...cloneSlide(next).elements
      ]
    }

    conversation.slides = [
      ...conversation.slides.slice(0, slideIndex),
      merged,
      ...conversation.slides.slice(slideIndex + 2)
    ]
    touchConversation(conversation, {
      bump: false,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
  }

  function fillStructuredRegions(slideIndex: number, conversationId?: string) {
    updateSlide(slideIndex, (slide) => {
      if (!slide.kind || !['question-answer', 'question-choice', 'question-material'].includes(slide.kind)) {
        return slide
      }

      const requiredRegions = EXPORT_LAYOUT_LIMITS.structuredRegionPriority[slide.kind]
      const presentRegions = new Set(slide.elements.map((element) => element.region).filter(Boolean))
      const additions = requiredRegions
        .filter((region) => !presentRegions.has(region))
        .map((region) => createStructuredPlaceholder(region))

      if (!additions.length) return slide
      return {
        ...slide,
        elements: [...slide.elements, ...additions]
      }
    }, conversationId)
  }

  function applyTemplate(slideIndex: number, templateId: string, conversationId?: string) {
    updateSlide(slideIndex, (slide) => standardizeSlideWithTemplate(slide, templateId), conversationId)
  }

  function convertSlideKind(slideIndex: number, kind: SlideKind, conversationId?: string) {
    updateSlide(slideIndex, (slide) => {
      const nextSlide: Slide = {
        ...slide,
        kind,
        layout: inferLayoutFromKind(kind)
      }

      if (kind === 'summary') {
        nextSlide.templateId = undefined
        nextSlide.title = nextSlide.title?.trim() || '课堂总结'
        nextSlide.elements = nextSlide.elements.length
          ? nextSlide.elements.map((element) => ({ ...element, region: 'summary' }))
          : [{ type: 'list', region: 'summary', items: ['总结要点'] }]
        return nextSlide
      }

      if (kind === 'explanation') {
        nextSlide.templateId = undefined
        nextSlide.title = nextSlide.title?.trim() || '讲解页'
        nextSlide.elements = nextSlide.elements.length
          ? nextSlide.elements.map((element) => ({
            ...element,
            region: element.region === 'summary' ? 'body' : (element.region ?? 'body')
          }))
          : [{ type: 'text', region: 'body', content: '请补充讲解内容' }]
        return nextSlide
      }

      return nextSlide
    }, conversationId)
  }

  function canMergeSlides(current: Slide, next: Slide): boolean {
    if (current.layout !== next.layout) return false
    if (current.kind !== next.kind) return false

    const currentTemplate = getSlideTemplate(current.templateId)
    const nextTemplate = getSlideTemplate(next.templateId)
    if (currentTemplate && nextTemplate && currentTemplate.id !== nextTemplate.id) {
      return false
    }

    return true
  }

  function setScene(scene: string, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    conversation.currentScene = scene
    conversation.currentTheme = scene
    touchConversation(conversation)
  }

  function addUserMessage(content: string, attachments?: UIAttachment[], conversationId?: string): string {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const id = createMessageId()
    const message: UIChatMessage = {
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete'
    }
    if (attachments && attachments.length > 0) {
      message.attachments = attachments
    }
    conversation.messages.push(message)
    refreshConversationTitle(conversation)
    touchConversation(conversation, {
      bump: true,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
    return id
  }

  function addAssistantMessage(conversationId?: string): string {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const id = createMessageId()
    conversation.messages.push({
      id,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming'
    })
    touchConversation(conversation, {
      bump: true,
      persistDelay: STRUCTURE_PERSIST_DEBOUNCE_MS
    })
    return id
  }

  function appendToAssistantMessage(id: string, chunk: string, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const msg = conversation.messages.find((message) => message.id === id)
    if (msg) {
      msg.content += chunk
      touchConversation(conversation, {
        bump: false,
        persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
      })
    }
  }

  function setAssistantMessageContent(id: string, content: string, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const msg = conversation.messages.find((message) => message.id === id)
    if (msg) {
      msg.content = content
      touchConversation(conversation, {
        bump: false,
        persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
      })
    }
  }

  function setMessageStatus(id: string, status: UIChatMessage['status'], conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const msg = conversation.messages.find((message) => message.id === id)
    if (msg) {
      msg.status = status
      touchConversation(conversation, {
        bump: false,
        persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
      })
    }
  }

  function setGenerating(value: boolean, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    conversation.isGenerating = value
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function resetLlmDebug(conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    conversation.llmDebug = createEmptyLlmDebug()
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function setPlanningDebugRaw(raw: string, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    conversation.llmDebug.planningRaw = raw
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  function setContentBatchDebugRaw(batchIndex: number, label: string, raw: string, conversationId?: string) {
    const conversation = findConversation(conversationId) ?? getActiveConversation()
    const nextBatches = conversation.llmDebug.contentBatches.slice()
    nextBatches[batchIndex] = { label, raw }
    conversation.llmDebug.contentBatches = nextBatches
    touchConversation(conversation, {
      bump: false,
      persistDelay: CONTENT_PERSIST_DEBOUNCE_MS
    })
  }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    markdown,
    slides,
    currentScene,
    currentTheme,
    messages,
    isGenerating,
    isAnyConversationGenerating,
    hasContent,
    initialize,
    createConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    setMarkdown,
    setSlides,
    updateSlide,
    updateSlideField,
    updateElement,
    insertElement,
    deleteElement,
    deleteElementAtPositionFromSlides,
    deleteRegionFromSlides,
    moveElement,
    deleteSlide,
    duplicateSlide,
    moveSlide,
    insertSlide,
    splitSlide,
    mergeSlideWithNext,
    canMergeSlides,
    fillStructuredRegions,
    applyTemplate,
    convertSlideKind,
    setScene,
    addUserMessage,
    addAssistantMessage,
    appendToAssistantMessage,
    setAssistantMessageContent,
    setMessageStatus,
    setGenerating,
    resetLlmDebug,
    setPlanningDebugRaw,
    setContentBatchDebugRaw
  }
})
