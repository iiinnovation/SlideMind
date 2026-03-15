<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { ArrowUp, Square, Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-vue-next'
import type { UIAttachment } from '@/types/llm'
import type { ParsedAttachment } from '../../../shared/types/attachment'

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  send: [content: string, attachments: UIAttachment[]]
}>()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const pendingAttachments = ref<UIAttachment[]>([])
const isParsingFile = ref(false)

const canSend = computed(() => {
  return !props.disabled && (inputText.value.trim().length > 0 || pendingAttachments.value.length > 0)
})

function adjustHeight() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

watch(inputText, () => {
  nextTick(adjustHeight)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  if (!canSend.value) return
  const content = inputText.value.trim()
  emit('send', content, [...pendingAttachments.value])
  inputText.value = ''
  pendingAttachments.value = []
  nextTick(adjustHeight)
}

function removeAttachment(id: string) {
  pendingAttachments.value = pendingAttachments.value.filter((a) => a.id !== id)
}

async function handleAttach() {
  if (!window.api || isParsingFile.value) return

  const filePaths = await window.api.selectFiles()
  if (!filePaths || filePaths.length === 0) return

  isParsingFile.value = true
  try {
    for (const filePath of filePaths) {
      const result = await window.api.parseFile(filePath)
      if (result.success && result.attachment) {
        const att = result.attachment as ParsedAttachment
        const uiAtt: UIAttachment = {
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          thumbnailDataUrl: att.thumbnailDataUrl,
          extractedText: att.extractedText,
          imageDataUrl: att.imageDataUrl
        }
        pendingAttachments.value.push(uiAtt)
      } else {
        console.error('File parse error:', result.error)
        alert(result.error || '文件解析失败')
      }
    }
  } finally {
    isParsingFile.value = false
  }
}
</script>

<template>
  <div class="rounded-xl border bg-surface shadow-soft">
    <!-- Attachment chips -->
    <div
      v-if="pendingAttachments.length > 0"
      class="flex flex-wrap gap-1.5 px-2.5 pt-2.5"
    >
      <div
        v-for="att in pendingAttachments"
        :key="att.id"
        class="flex items-center gap-1.5 rounded-lg border bg-page px-2 py-1"
      >
        <img
          v-if="att.thumbnailDataUrl"
          :src="att.thumbnailDataUrl"
          :alt="att.fileName"
          class="h-6 w-6 rounded object-cover"
        />
        <component
          :is="att.fileType === 'image' ? ImageIcon : FileText"
          v-else
          :size="14"
          :stroke-width="1.5"
          class="text-text-secondary"
        />
        <span class="max-w-[120px] truncate text-xs text-text-secondary">{{ att.fileName }}</span>
        <button
          class="inline-flex items-center justify-center rounded-full p-0.5 text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
          @click="removeAttachment(att.id)"
        >
          <X :size="12" :stroke-width="1.5" />
        </button>
      </div>
    </div>

    <!-- Input row -->
    <div class="flex items-end gap-2 p-2">
      <button
        class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]"
        :class="{ 'opacity-50 cursor-not-allowed': isParsingFile }"
        :disabled="isParsingFile"
        @click="handleAttach"
      >
        <Loader2
          v-if="isParsingFile"
          :size="16"
          :stroke-width="1.5"
          class="animate-spin"
        />
        <Paperclip v-else :size="16" :stroke-width="1.5" />
      </button>

      <textarea
        ref="textareaRef"
        v-model="inputText"
        :placeholder="placeholder || '输入教学内容，AI 帮你生成课件...'"
        :disabled="disabled"
        rows="1"
        class="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
        style="max-height: 120px"
        @keydown="handleKeydown"
      />
      <button
        class="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-[0.98]"
        :class="canSend
          ? 'bg-accent text-white hover:bg-accent-hover'
          : 'bg-surface-hover text-text-muted cursor-not-allowed'"
        :disabled="!canSend"
        @click="handleSend"
      >
        <Square v-if="disabled" :size="14" :stroke-width="1.5" />
        <ArrowUp v-else :size="16" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>
