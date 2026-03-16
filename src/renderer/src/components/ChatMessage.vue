<script setup lang="ts">
import { FileText, Image as ImageIcon } from 'lucide-vue-next'
import type { UIChatMessage } from '@/types/llm'
import { formatMessagePreview } from '@/services/conversationPreview'

defineProps<{
  message: UIChatMessage
}>()
</script>

<template>
  <div
    class="flex"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[80%] px-3.5 py-2.5 text-sm"
      :class="message.role === 'user'
        ? 'rounded-xl rounded-tr-sm bg-user-bubble text-text-primary'
        : 'rounded-xl rounded-tl-sm bg-surface border text-text-primary'"
    >
      <template v-if="message.role === 'user'">
        <!-- Attachment chips -->
        <div
          v-if="message.attachments && message.attachments.length > 0"
          class="mb-1.5 flex flex-wrap gap-1"
        >
          <div
            v-for="att in message.attachments"
            :key="att.id"
            class="flex items-center gap-1 rounded border border-[rgba(0,0,0,0.06)] bg-[rgba(255,255,255,0.5)] px-1.5 py-0.5"
          >
            <img
              v-if="att.thumbnailDataUrl"
              :src="att.thumbnailDataUrl"
              :alt="att.fileName"
              class="h-5 w-5 rounded object-cover"
            />
            <component
              :is="att.fileType === 'image' ? ImageIcon : FileText"
              v-else
              :size="12"
              :stroke-width="1.5"
              class="text-text-secondary"
            />
            <span class="max-w-[100px] truncate text-xs text-text-secondary">{{ att.fileName }}</span>
          </div>
        </div>
        <span v-if="message.content">{{ message.content }}</span>
      </template>
      <template v-else>
        <span>{{ message.status === 'streaming' && !message.content ? '正在整理课件结构...' : formatMessagePreview(message.content) }}</span>
        <span
          v-if="message.status === 'streaming'"
          class="ml-0.5 inline-block h-3.5 w-0.5 bg-accent"
          style="animation: blink 1s step-end infinite"
        />
        <span
          v-if="message.status === 'complete'"
          class="ml-2 inline-flex rounded-full bg-[#eef3e7] px-2 py-0.5 text-[11px] font-medium text-[#55773d]"
        >
          已完成
        </span>
        <span
          v-if="message.status === 'error'"
          class="text-error"
        >
          生成失败，请重试
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
