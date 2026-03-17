<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, toRef } from 'vue'
import { useSlideRenderer } from '../composables/useSlideRenderer'
import { useShadowDom } from '../composables/useShadowDom'
import { useEditorStore } from '../stores/editor'
import { useSettingsStore } from '../stores/settings'
import { ChevronLeft, ChevronRight, Download } from 'lucide-vue-next'
import type { Slide } from '../../../shared/types/slide'
import type { PresentationTypographySettings } from '../../../shared/types/settings'

const props = defineProps<{
  slides: Slide[]
  theme: string
  currentSlideIndex?: number
}>()

const emit = defineEmits<{
  'update:currentSlideIndex': [index: number]
}>()

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const typographySettings = computed<PresentationTypographySettings>(() => ({
  titleFontFamily: settingsStore.presentationTitleFontFamily,
  bodyFontFamily: settingsStore.presentationBodyFontFamily,
  titleFontSize: settingsStore.presentationTitleFontSize,
  bodyFontSize: settingsStore.presentationBodyFontSize
}))

const previewContainerRef = ref<HTMLElement | null>(null)
const containerScale = ref(1)
const isExporting = ref(false)

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
  toRef(editorStore, 'isGenerating'),
  typographySettings
)

const { hostRef, contentHeight, updateCSS, updateSlide, clear } = useShadowDom()
const activeSlide = computed(() => props.slides[currentSlide.value] ?? null)
const previewHeight = computed(() => {
  const slide = activeSlide.value
  if (!slide) return 720
  if (slide.kind === 'question-answer' || slide.kind === 'question-choice' || slide.kind === 'question-material') {
    return Math.max(320, contentHeight.value)
  }
  return 720
})

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

watch(
  () => props.currentSlideIndex,
  (index) => {
    if (typeof index === 'number' && index !== currentSlide.value) {
      goToSlide(index)
    }
  }
)

watch(currentSlide, (index) => {
  emit('update:currentSlideIndex', index)
})

let resizeObserver: ResizeObserver | null = null

function updateScale() {
  if (!previewContainerRef.value) return
  const rect = previewContainerRef.value.getBoundingClientRect()
  const scaleX = rect.width / 1280
  const scaleY = rect.height / previewHeight.value
  containerScale.value = Math.min(scaleX, scaleY, 1)
}

onMounted(() => {
  if (previewContainerRef.value) {
    resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(previewContainerRef.value)
  }
  updateScale()
})

watch([totalSlides, currentSlide, previewHeight], () => {
  updateScale()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

async function runExport() {
  isExporting.value = true
  const result = await window.api.exportPptx(
    JSON.parse(JSON.stringify(editorStore.slides)),
    editorStore.currentTheme,
    typographySettings.value
  )
  isExporting.value = false
  if (result.success) {
    alert(`导出成功：${result.filePath}`)
  } else if (result.reason !== 'cancelled') {
    alert(`导出失败：${result.reason}`)
  }
}

async function handleExport() {
  await runExport()
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-page">
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
        :disabled="isExporting"
        @click="handleExport"
      >
        <Download :size="13" :stroke-width="1.5" />
        {{ isExporting ? '导出中...' : '导出 PPT' }}
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
          height: previewHeight * containerScale + 'px'
        }"
      >
        <div
          ref="hostRef"
          :style="{
            width: '1280px',
            height: `${previewHeight}px`,
            '--slide-preview-height': `${previewHeight}px`,
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
