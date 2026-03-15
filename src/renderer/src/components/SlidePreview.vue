<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, toRef } from 'vue'
import { useSlideRenderer } from '../composables/useSlideRenderer'
import { useShadowDom } from '../composables/useShadowDom'
import { useEditorStore } from '../stores/editor'
import { ChevronLeft, ChevronRight, Download } from 'lucide-vue-next'
import type { Slide } from '../../../shared/types/slide'

const props = defineProps<{
  slides: Slide[]
  theme: string
}>()

const editorStore = useEditorStore()

const previewContainerRef = ref<HTMLElement | null>(null)
const containerScale = ref(1)

const {
  renderedCSS,
  currentSlide,
  currentSlideHTML,
  totalSlides,
  nextSlide,
  prevSlide,
  goToSlide
} = useSlideRenderer(
  toRef(props, 'slides'),
  toRef(props, 'theme'),
  toRef(editorStore, 'isGenerating')
)

const { hostRef, updateCSS, updateSlide, clear } = useShadowDom()

// Push CSS changes to Shadow DOM
watch(renderedCSS, (css) => {
  updateCSS(css)
})

// Push slide HTML changes to Shadow DOM
watch(currentSlideHTML, (html) => {
  if (html) {
    updateSlide(html)
  } else {
    clear()
  }
})

// Reset to first slide when switching conversations
watch(() => editorStore.activeConversationId, () => {
  goToSlide(0)
})

let resizeObserver: ResizeObserver | null = null

function updateScale() {
  if (!previewContainerRef.value) return
  const rect = previewContainerRef.value.getBoundingClientRect()
  const scaleX = rect.width / 1280
  const scaleY = rect.height / 720
  containerScale.value = Math.min(scaleX, scaleY, 1)
}

onMounted(() => {
  if (previewContainerRef.value) {
    resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(previewContainerRef.value)
  }
  updateScale()
})

watch([totalSlides, currentSlide], () => {
  updateScale()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

async function handleExport() {
  const result = await window.api.exportPptx(
    JSON.parse(JSON.stringify(editorStore.slides)),
    editorStore.currentTheme
  )
  if (result.success) {
    alert(`导出成功：${result.filePath}`)
  } else if (result.reason !== 'cancelled') {
    alert(`导出失败：${result.reason}`)
  }
}
</script>

<template>
  <div class="flex h-full flex-col bg-page">
    <!-- Top bar: page indicator + export -->
    <div class="relative flex items-center justify-between border-b px-4 py-2">
      <!-- Left: page indicator + status -->
      <div class="flex items-center gap-2">
        <span v-if="totalSlides > 0" class="text-xs text-text-muted">
          {{ currentSlide + 1 }} / {{ totalSlides }}
        </span>
        <span v-else class="text-xs text-text-muted">预览</span>
        <span
          class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="editorStore.isGenerating
            ? 'bg-[#f6eadf] text-[#a65b32]'
            : 'bg-[#eef3e7] text-[#55773d]'"
        >
          {{ editorStore.isGenerating ? '生成中' : totalSlides > 0 ? '已完成' : '待生成' }}
        </span>
      </div>

      <!-- Right: export button -->
      <button
        v-if="totalSlides > 0"
        class="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-xs text-white transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active"
        @click="handleExport"
      >
        <Download :size="13" :stroke-width="1.5" />
        导出 PPT
      </button>
      <div v-else />
    </div>

    <!-- Preview: Slide area -->
    <div
      ref="previewContainerRef"
      class="flex flex-1 items-center justify-center overflow-hidden p-4"
    >
      <div
        v-if="totalSlides > 0"
        class="overflow-hidden rounded-lg shadow-soft"
        :style="{
          width: 1280 * containerScale + 'px',
          height: 720 * containerScale + 'px'
        }"
      >
        <div
          ref="hostRef"
          :style="{
            width: '1280px',
            height: '720px',
            transform: `scale(${containerScale})`,
            transformOrigin: 'top left'
          }"
        />
      </div>
      <div
        v-else
        class="text-sm text-text-muted"
      >
        课件预览将在此处显示
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalSlides > 1"
      class="flex items-center justify-center gap-3 border-t px-4 py-2"
    >
      <button
        class="inline-flex items-center justify-center rounded p-1 text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.98] disabled:opacity-30 disabled:hover:bg-transparent"
        :disabled="currentSlide === 0"
        @click="prevSlide"
      >
        <ChevronLeft :size="18" :stroke-width="1.5" />
      </button>

      <div class="flex items-center gap-1.5">
        <button
          v-for="i in totalSlides"
          :key="i"
          class="h-1.5 rounded-full transition-all duration-150"
          :class="currentSlide === i - 1
            ? 'w-4 bg-accent'
            : 'w-1.5 bg-text-muted/30 hover:bg-text-muted/50'"
          @click="goToSlide(i - 1)"
        />
      </div>

      <button
        class="inline-flex items-center justify-center rounded p-1 text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.98] disabled:opacity-30 disabled:hover:bg-transparent"
        :disabled="currentSlide === totalSlides - 1"
        @click="nextSlide"
      >
        <ChevronRight :size="18" :stroke-width="1.5" />
      </button>
    </div>
  </div>
</template>
