import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { EditorConversation, UIChatMessage, UIAttachment } from '@/types/llm'
import type { Slide } from '../../../shared/types/slide'
import type { EditorStateSnapshot, StoredEditorConversation, StoredAttachment } from '../../../shared/types/session'

const MAX_PERSISTED_CONVERSATIONS = 30
const CONTENT_PERSIST_DEBOUNCE_MS = 2000
const STRUCTURE_PERSIST_DEBOUNCE_MS = 400

export const useEditorStore = defineStore('editor', () => {
  const conversations = ref<EditorConversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const isReady = ref(false)
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  function createMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
            thumbnailDataUrl: att.thumbnailDataUrl
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
    setScene,
    addUserMessage,
    addAssistantMessage,
    appendToAssistantMessage,
    setAssistantMessageContent,
    setMessageStatus,
    setGenerating
  }
})
