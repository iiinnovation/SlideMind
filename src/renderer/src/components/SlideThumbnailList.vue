<script setup lang="ts">
import { computed, ref } from 'vue'
import { getSlideDiagnosticSummary } from '../services/slideDiagnostics'
import type { Slide, SlideElement } from '../../../shared/types/slide'

const props = defineProps<{
  slides: Slide[]
  currentSlideIndex: number
  selectedSlideIndices: number[]
}>()

const emit = defineEmits<{
  select: [index: number]
  toggleSelect: [index: number]
  selectAll: []
  clearSelection: []
}>()

const filterMode = ref<'all' | 'risk'>('all')

function slideLabel(slide: Slide, index: number): string {
  return slide.title?.trim() || slide.kind || slide.layout || `页面 ${index + 1}`
}

function slideSummary(slide: Slide): string {
  const parts: string[] = []

  for (const element of slide.elements) {
    const value = summarizeElement(element)
    if (value) {
      parts.push(value)
    }
    if (parts.length >= 2) break
  }

  return parts.join(' / ')
}

function summarizeElement(element: SlideElement): string {
  switch (element.type) {
    case 'heading':
    case 'text':
    case 'blockquote':
      return element.content.trim()
    case 'list':
      return element.items.slice(0, 2).join('、')
    case 'table':
      return element.headers.join(' | ')
    case 'image':
      return element.alt?.trim() || '图片占位'
  }
}

const diagnosticsBySlide = computed(() =>
  props.slides.map((slide) => getSlideDiagnosticSummary(slide))
)

const visibleSlides = computed(() =>
  props.slides
    .map((slide, index) => ({
      slide,
      index,
      diagnostics: diagnosticsBySlide.value[index]
    }))
    .filter((item) => filterMode.value === 'all' || item.diagnostics.count > 0)
)
</script>

<template>
  <aside class="flex h-full w-[clamp(160px,15vw,220px)] shrink-0 flex-col border-r bg-[#f7f5f0]">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-medium text-text-primary">页面列表</h2>
      <div class="mt-2 flex items-center gap-2">
        <button
          class="rounded-full px-2 py-1 text-[11px] transition"
          :class="filterMode === 'all'
            ? 'bg-[#e9ddd2] text-[#7e5843]'
            : 'bg-white text-text-muted hover:bg-[#f3ece5]'"
          @click="filterMode = 'all'"
        >
          全部
        </button>
        <button
          class="rounded-full px-2 py-1 text-[11px] transition"
          :class="filterMode === 'risk'
            ? 'bg-[#fdeaea] text-[#b84b4b]'
            : 'bg-white text-text-muted hover:bg-[#f3ece5]'"
          @click="filterMode = 'risk'"
        >
          问题页
        </button>
      </div>
      <div class="mt-2 flex items-center gap-2 text-[11px]">
        <button
          class="rounded-full bg-white px-2 py-1 text-text-muted transition hover:bg-[#f3ece5]"
          @click="emit('selectAll')"
        >
          全选
        </button>
        <button
          class="rounded-full bg-white px-2 py-1 text-text-muted transition hover:bg-[#f3ece5]"
          @click="emit('clearSelection')"
        >
          清空
        </button>
        <span class="text-text-muted">已选 {{ props.selectedSlideIndices.length }} 页</span>
      </div>
    </div>

    <div class="flex-1 space-y-2 overflow-y-auto px-3 py-3">
      <button
        v-for="item in visibleSlides"
        :key="`${item.slide.kind || item.slide.layout}-${item.index}`"
        class="w-full rounded-xl border px-3 py-3 text-left transition"
        :class="item.index === currentSlideIndex
          ? 'border-[#c49b81] bg-[#fff9f4] shadow-sm'
          : 'border-border bg-white hover:border-[#dbc5b6] hover:bg-[#fcfaf8]'"
        @click="emit('select', item.index)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-border"
              :checked="props.selectedSlideIndices.includes(item.index)"
              @click.stop
              @change="emit('toggleSelect', item.index)"
            >
            <span class="text-xs font-medium text-text-secondary">第 {{ item.index + 1 }} 页</span>
          </div>
          <div class="flex items-center gap-1">
            <span
              v-if="item.diagnostics?.count"
              class="rounded-full px-2 py-0.5 text-[10px] font-medium"
              :class="item.diagnostics?.highestLevel === 'error'
                ? 'bg-[#fdeaea] text-[#b84b4b]'
                : 'bg-[#fff2dd] text-[#9b6a1f]'"
            >
              {{ item.diagnostics?.highestLevel === 'error' ? '高风险' : '需调整' }}
            </span>
            <span class="text-[11px] uppercase tracking-[0.08em] text-text-muted">
              {{ item.slide.kind || item.slide.layout }}
            </span>
          </div>
        </div>
        <div class="mt-2 line-clamp-2 text-sm font-medium text-text-primary">
          {{ slideLabel(item.slide, item.index) }}
        </div>
        <div class="mt-2 rounded-lg bg-[#f6f2eb] px-2 py-2 text-xs text-text-secondary">
          <div class="line-clamp-2 min-h-[2.5rem]">
            {{ slideSummary(item.slide) || '暂无内容摘要' }}
          </div>
        </div>
        <div class="mt-2 text-xs text-text-muted">
          {{ item.slide.elements.length }} 个元素
          <span v-if="item.diagnostics?.count">
            · {{ item.diagnostics?.count }} 个提示
          </span>
        </div>
      </button>
      <div
        v-if="filterMode === 'risk' && visibleSlides.length === 0"
        class="rounded-xl border border-dashed border-border bg-white px-3 py-6 text-center text-xs text-text-muted"
      >
        当前没有问题页
      </div>
    </div>
  </aside>
</template>
