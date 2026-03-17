<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useEditorStore } from '../stores/editor'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'
import type { UIAttachment } from '@/types/llm'

const editorStore = useEditorStore()
const scrollContainerRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  send: [content: string, attachments: UIAttachment[]]
  stop: []
}>()

watch(
  () => editorStore.messages.length,
  () => {
    nextTick(() => {
      if (scrollContainerRef.value) {
        scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
      }
    })
  }
)

watch(
  () => editorStore.activeConversationId,
  () => {
    nextTick(() => {
      if (scrollContainerRef.value) {
        scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
      }
    })
  }
)

// Also auto-scroll during streaming
watch(
  () => {
    const msgs = editorStore.messages
    const last = msgs[msgs.length - 1]
    return last?.status === 'streaming' ? last.content.length : -1
  },
  () => {
    nextTick(() => {
      if (scrollContainerRef.value) {
        scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
      }
    })
  }
)
</script>

<template>
  <div class="flex h-full flex-col bg-page">
    <!-- Messages -->
    <div
      ref="scrollContainerRef"
      class="flex-1 space-y-3 overflow-y-auto p-4"
    >
      <ChatMessage
        v-for="msg in editorStore.messages"
        :key="msg.id"
        :message="msg"
      />
    </div>

    <!-- Input -->
    <div class="border-t p-3">
      <ChatInput
        :disabled="editorStore.isGenerating"
        placeholder="输入修改要求..."
        @send="(content, attachments) => emit('send', content, attachments)"
        @stop="emit('stop')"
      />
    </div>
  </div>
</template>
