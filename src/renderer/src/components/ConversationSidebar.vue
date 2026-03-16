<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  Pencil,
  Search,
  Trash2,
  X
} from 'lucide-vue-next'
import { useEditorStore } from '@/stores/editor'
import { formatMessagePreview } from '@/services/conversationPreview'

const props = defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const editorStore = useEditorStore()
const searchQuery = ref('')
const editingId = ref<string | null>(null)
const editingTitle = ref('')

const conversations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return editorStore.conversations

  return editorStore.conversations.filter((conversation) => {
    const lastMessage = conversation.messages[conversation.messages.length - 1]
    const firstUserMessage = conversation.messages.find((message) => message.role === 'user')
    const haystack = [
      conversation.title,
      firstUserMessage?.content ?? '',
      lastMessage?.content ?? ''
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
})

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

function summarizeConversation(conversationId: string) {
  const conversation = editorStore.conversations.find((item) => item.id === conversationId)
  if (!conversation) return '新建对话'

  const lastMessage = conversation.messages[conversation.messages.length - 1]
  if (lastMessage?.content) {
    return formatMessagePreview(lastMessage.content, 36)
  }

  if (conversation.markdown) {
    return formatMessagePreview(conversation.markdown, 36)
  }

  return '等待输入课件需求'
}

function startRename(conversationId: string, title: string) {
  editingId.value = conversationId
  editingTitle.value = title
}

function cancelRename() {
  editingId.value = null
  editingTitle.value = ''
}

function confirmRename() {
  if (!editingId.value) return
  editorStore.renameConversation(editingId.value, editingTitle.value)
  cancelRename()
}

function handleDelete(conversationId: string) {
  editorStore.deleteConversation(conversationId)
  if (editingId.value === conversationId) {
    cancelRename()
  }
}
</script>

<template>
  <aside
    class="flex h-full flex-col border-r bg-white/70 backdrop-blur-sm transition-all duration-200"
    :class="props.collapsed ? 'w-0 overflow-hidden border-r-0 opacity-0' : 'w-[300px] opacity-100'"
    :aria-hidden="props.collapsed"
  >
    <div class="border-b px-3 py-4">
      <div class="mb-3 flex items-center justify-between">
        <div class="pl-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-text-muted">
          会话
        </div>

        <button
          class="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-white px-3 py-2 text-text-secondary shadow-sm transition-all duration-150 hover:border-[#d0b09b] hover:bg-[#fcf7f3] hover:text-text-primary"
          title="收起会话栏"
          @click="emit('toggle')"
        >
          <ChevronLeft :size="16" :stroke-width="1.75" />
          <span class="text-xs font-medium">收起</span>
        </button>
      </div>

      <button
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-accent-hover active:scale-[0.99] active:bg-accent-active disabled:opacity-60"
        :disabled="editorStore.isAnyConversationGenerating"
        @click="editorStore.createConversation()"
      >
        <MessageSquarePlus :size="16" :stroke-width="1.75" />
        <span>新建对话</span>
      </button>

      <div class="relative mt-3">
        <Search
          :size="15"
          :stroke-width="1.75"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索会话内容"
          class="w-full rounded-lg border border-border bg-white px-9 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-accent"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto space-y-2 px-3 py-3">
      <button
        v-for="conversation in conversations"
        :key="conversation.id"
        class="group w-full text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70"
        :class="conversation.id === editorStore.activeConversationId
          ? 'rounded-xl border border-accent bg-[#f7eee9] px-3 py-3 shadow-sm'
          : 'rounded-xl border border-transparent px-3 py-3 hover:border-border hover:bg-surface-hover'"
        :disabled="editorStore.isAnyConversationGenerating"
        @click="editorStore.switchConversation(conversation.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div v-if="editingId === conversation.id" class="flex items-center gap-1">
              <input
                v-model="editingTitle"
                type="text"
                maxlength="40"
                class="min-w-0 flex-1 rounded-md border border-accent bg-white px-2 py-1 text-sm text-text-primary outline-none"
                @click.stop
                @keydown.enter.prevent="confirmRename"
                @keydown.esc.prevent="cancelRename"
              />
              <button
                class="inline-flex items-center justify-center rounded p-1 text-text-secondary hover:bg-white hover:text-text-primary"
                @click.stop="confirmRename"
              >
                <Check :size="14" :stroke-width="1.75" />
              </button>
              <button
                class="inline-flex items-center justify-center rounded p-1 text-text-secondary hover:bg-white hover:text-text-primary"
                @click.stop="cancelRename"
              >
                <X :size="14" :stroke-width="1.75" />
              </button>
            </div>

            <template v-else>
              <div class="truncate text-sm font-medium text-text-primary">
                {{ conversation.title }}
              </div>
              <div class="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                {{ summarizeConversation(conversation.id) }}
              </div>
            </template>
          </div>

          <div class="flex shrink-0 items-start gap-1">
            <div class="pt-0.5 text-[11px] text-text-muted">
              {{ formatTime(conversation.updatedAt) }}
            </div>
            <div class="flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <button
                class="inline-flex items-center justify-center rounded p-1 text-text-secondary hover:bg-white hover:text-text-primary"
                :disabled="editorStore.isAnyConversationGenerating"
                @click.stop="startRename(conversation.id, conversation.title)"
              >
                <Pencil :size="13" :stroke-width="1.75" />
              </button>
              <button
                class="inline-flex items-center justify-center rounded p-1 text-text-secondary hover:bg-white hover:text-red-600 disabled:opacity-40"
                :disabled="editorStore.isAnyConversationGenerating || editorStore.conversations.length <= 1"
                @click.stop="handleDelete(conversation.id)"
              >
                <Trash2 :size="13" :stroke-width="1.75" />
              </button>
            </div>
          </div>
        </div>
      </button>

      <div
        v-if="conversations.length === 0"
        class="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted"
      >
        没有匹配的会话
      </div>
    </div>
  </aside>
</template>
