<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-vue-next'
import { getSceneTemplates } from '../../../shared/templates'
import { useEditorStore } from '../stores/editor'
import { getRecommendedTemplates, getSlideDiagnostics } from '../services/slideDiagnostics'
import type { Slide, SlideElement, SlideKind, SlideRegion } from '../../../shared/types/slide'

const props = defineProps<{
  slides: Slide[]
  currentSlideIndex: number
  selectedSlideIndices: number[]
}>()

const emit = defineEmits<{
  'update:currentSlideIndex': [index: number]
}>()

const editorStore = useEditorStore()
const newSlideKind = ref<SlideKind>('knowledge-points')
const newElementType = ref<SlideElement['type']>('text')
const selectedTemplateId = ref('')
const batchElementPosition = ref(4)
const batchRegionToDelete = ref<SlideRegion>('tips')

const currentSlide = computed(() => props.slides[props.currentSlideIndex] ?? null)
const canEdit = computed(() => !editorStore.isGenerating && currentSlide.value !== null)
const currentDiagnostics = computed(() => currentSlide.value ? getSlideDiagnostics(currentSlide.value) : [])
const llmDebug = computed(() => editorStore.activeConversation.llmDebug)
const debugAttachments = computed(() =>
  editorStore.messages
    .filter((message) => message.role === 'user' && message.attachments && message.attachments.length > 0)
    .flatMap((message) => message.attachments ?? [])
)
const nextSlide = computed(() => props.slides[props.currentSlideIndex + 1] ?? null)
const canMergeWithNext = computed(() => (
  canEdit.value &&
  currentSlide.value !== null &&
  nextSlide.value !== null &&
  editorStore.canMergeSlides(currentSlide.value, nextSlide.value)
))
const sceneTemplates = computed(() => getSceneTemplates(editorStore.currentScene as 'new-lesson' | 'mistake-review'))
const compatibleTemplates = computed(() => {
  if (!currentSlide.value) return sceneTemplates.value
  return sceneTemplates.value.filter((template) => template.layout === currentSlide.value?.layout || template.kind === currentSlide.value?.kind)
})
const recommendedTemplates = computed(() => (
  currentSlide.value
    ? getRecommendedTemplates(editorStore.currentScene as 'new-lesson' | 'mistake-review', currentSlide.value)
    : []
))

const kindOptions: Array<{ label: string; value: SlideKind }> = [
  { label: '知识点页', value: 'knowledge-points' },
  { label: '讲解页', value: 'explanation' },
  { label: '错题页', value: 'question-answer' },
  { label: '选择题页', value: 'question-choice' },
  { label: '材料题页', value: 'question-material' },
  { label: '总结页', value: 'summary' }
]

const elementOptions: Array<{ label: string; value: SlideElement['type'] }> = [
  { label: '段落', value: 'text' },
  { label: '列表', value: 'list' },
  { label: '小标题', value: 'heading' },
  { label: '引用', value: 'blockquote' },
  { label: '表格', value: 'table' },
  { label: '图片占位', value: 'image' }
]

const regionOptions: Array<{ label: string; value: '' | SlideRegion }> = [
  { label: '默认区域', value: '' },
  { label: '导语', value: 'hero' },
  { label: '概览', value: 'lead' },
  { label: '正文', value: 'body' },
  { label: '题干', value: 'question' },
  { label: '选项', value: 'options' },
  { label: '材料', value: 'material' },
  { label: '解析', value: 'analysis' },
  { label: '答案', value: 'answer' },
  { label: '提醒', value: 'tips' },
  { label: '总结', value: 'summary' },
  { label: '备注', value: 'footer' }
]

function elementLabel(element: SlideElement, index: number): string {
  const region = element.region ? ` · ${element.region}` : ''
  switch (element.type) {
    case 'heading':
      return `小标题 ${index + 1}${region}`
    case 'text':
      return `段落 ${index + 1}${region}`
    case 'list':
      return `列表 ${index + 1}${region}`
    case 'blockquote':
      return `引用 ${index + 1}${region}`
    case 'table':
      return `表格 ${index + 1}${region}`
    case 'image':
      return `图片 ${index + 1}${region}`
  }
}

function updateTitle(field: 'title' | 'subtitle', value: string) {
  editorStore.updateSlideField(props.currentSlideIndex, field, value)
}

function updateElementContent(elementIndex: number, value: string) {
  editorStore.updateElement(props.currentSlideIndex, elementIndex, (element) => {
    if (element.type === 'list') {
      return {
        ...element,
        items: value.split('\n').map((item) => item.trim()).filter(Boolean)
      }
    }

    if (element.type === 'table') {
      const [headerLine, ...rowLines] = value.split('\n').map((line) => line.trim()).filter(Boolean)
      return {
        ...element,
        headers: headerLine ? headerLine.split('|').map((cell) => cell.trim()).filter(Boolean) : element.headers,
        rows: rowLines.map((line) => line.split('|').map((cell) => cell.trim()))
      }
    }

    if (element.type === 'image') {
      return {
        ...element,
        alt: value.trim() || undefined
      }
    }

    return {
      ...element,
      content: value
    }
  })
}

function getElementValue(element: SlideElement): string {
  switch (element.type) {
    case 'list':
      return element.items.join('\n')
    case 'table':
      return [element.headers.join(' | '), ...element.rows.map((row) => row.join(' | '))].join('\n')
    case 'image':
      return element.alt ?? ''
    default:
      return element.content
  }
}

function deleteCurrentSlide() {
  editorStore.deleteSlide(props.currentSlideIndex)
  emit('update:currentSlideIndex', Math.max(0, props.currentSlideIndex - 1))
}

function duplicateCurrentSlide() {
  editorStore.duplicateSlide(props.currentSlideIndex)
  emit('update:currentSlideIndex', props.currentSlideIndex + 1)
}

function moveCurrentSlide(direction: 'up' | 'down') {
  editorStore.moveSlide(props.currentSlideIndex, direction)
  emit('update:currentSlideIndex', direction === 'up' ? props.currentSlideIndex - 1 : props.currentSlideIndex + 1)
}

function insertSlide() {
  editorStore.insertSlide(newSlideKind.value, props.currentSlideIndex + 1)
  emit('update:currentSlideIndex', props.currentSlideIndex + 1)
}

function splitCurrentSlide() {
  editorStore.splitSlide(props.currentSlideIndex)
}

function mergeWithNextSlide() {
  editorStore.mergeSlideWithNext(props.currentSlideIndex)
}

function fillCurrentStructuredRegions() {
  editorStore.fillStructuredRegions(props.currentSlideIndex)
}

function convertCurrentSlide(kind: SlideKind) {
  editorStore.convertSlideKind(props.currentSlideIndex, kind)
}

function applySelectedTemplate() {
  if (!selectedTemplateId.value) return
  editorStore.applyTemplate(props.currentSlideIndex, selectedTemplateId.value)
}

function applyRecommendedTemplate(templateId: string) {
  selectedTemplateId.value = templateId
  editorStore.applyTemplate(props.currentSlideIndex, templateId)
}

function insertElement() {
  editorStore.insertElement(props.currentSlideIndex, newElementType.value)
}

function deleteElement(index: number) {
  editorStore.deleteElement(props.currentSlideIndex, index)
}

function deleteBatchElementAtPosition() {
  editorStore.deleteElementAtPositionFromSlides(
    props.selectedSlideIndices,
    batchElementPosition.value - 1
  )
}

function deleteBatchRegion() {
  editorStore.deleteRegionFromSlides(
    props.selectedSlideIndices,
    batchRegionToDelete.value
  )
}

function moveElement(index: number, direction: 'up' | 'down') {
  editorStore.moveElement(props.currentSlideIndex, index, direction)
}

function updateElementType(index: number, nextType: SlideElement['type']) {
  editorStore.updateElement(props.currentSlideIndex, index, (element) => convertElementType(element, nextType))
}

function updateElementRegion(index: number, nextRegion: '' | SlideRegion) {
  editorStore.updateElement(props.currentSlideIndex, index, (element) => ({
    ...element,
    region: nextRegion || undefined
  }))
}

function convertElementType(element: SlideElement, nextType: SlideElement['type']): SlideElement {
  if (element.type === nextType) return element

  const textValue = getElementValue(element).trim()
  switch (nextType) {
    case 'heading':
      return {
        type: 'heading',
        level: 3,
        region: element.region,
        content: textValue || '新小标题'
      }
    case 'text':
      return {
        type: 'text',
        region: element.region,
        content: textValue || '请编辑正文内容'
      }
    case 'list':
      return {
        type: 'list',
        region: element.region,
        items: textValue ? textValue.split('\n').map((item) => item.trim()).filter(Boolean) : ['第一条', '第二条']
      }
    case 'blockquote':
      return {
        type: 'blockquote',
        region: element.region,
        content: textValue || '请编辑引用内容'
      }
    case 'table': {
      const rows = textValue
        ? textValue.split('\n').map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean))
        : []
      return {
        type: 'table',
        region: element.region,
        headers: rows[0]?.length ? rows[0] : ['列一', '列二'],
        rows: rows.slice(1).filter((row) => row.length > 0)
      }
    }
    case 'image':
      return {
        type: 'image',
        region: element.region,
        src: '',
        alt: textValue || '图片说明'
      }
  }
}

watch(
  currentSlide,
  (slide) => {
    selectedTemplateId.value = slide?.templateId ?? ''
  },
  { immediate: true }
)
</script>

<template>
  <aside class="flex h-full w-[clamp(260px,24vw,340px)] shrink-0 flex-col border-l bg-[#fbfaf7]">
    <div class="border-b px-4 py-3">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-medium text-text-primary">页面编辑</h2>
          <p class="mt-1 text-xs text-text-muted">
            {{ currentSlide ? `第 ${currentSlideIndex + 1} 页` : '暂无可编辑页面' }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <template v-if="currentSlide">
        <div
          v-if="currentDiagnostics.length"
          class="mb-4 rounded-xl border border-[#ecd8c9] bg-[#fff9f4] p-3"
        >
          <div class="text-xs font-medium text-[#8d5d43]">页面风险提示</div>
          <div class="mt-2 space-y-2">
            <div
              v-for="item in currentDiagnostics"
              :key="`${item.code}-${item.message}`"
              class="rounded-lg px-2 py-2 text-xs"
              :class="item.level === 'error'
                ? 'bg-[#fdeaea] text-[#a74b4b]'
                : 'bg-[#fff2dd] text-[#8c6720]'"
            >
              {{ item.message }}
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-text-secondary">标题</span>
            <input
              :value="currentSlide.title || ''"
              class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-[#c49b81]"
              :disabled="!canEdit"
              @input="updateTitle('title', ($event.target as HTMLInputElement).value)"
            >
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-text-secondary">副标题</span>
            <input
              :value="currentSlide.subtitle || ''"
              class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-[#c49b81]"
              :disabled="!canEdit"
              @input="updateTitle('subtitle', ($event.target as HTMLInputElement).value)"
            >
          </label>
        </div>

        <div class="mt-5 rounded-xl border border-border bg-white p-3">
          <div class="mb-2 text-xs font-medium text-text-secondary">快捷修正</div>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
              :disabled="!canEdit || !currentSlide || currentSlide.elements.length <= 1"
              @click="splitCurrentSlide"
            >
              一键拆页
            </button>
            <button
              class="rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
              :disabled="!canMergeWithNext"
              @click="mergeWithNextSlide"
            >
              合并下一页
            </button>
            <button
              class="rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
              :disabled="!canEdit || !['question-answer', 'question-choice', 'question-material'].includes(currentSlide.kind || '')"
              @click="fillCurrentStructuredRegions"
            >
              补标准结构
            </button>
            <button
              class="rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
              :disabled="!canEdit"
              @click="convertCurrentSlide('summary')"
            >
              转总结页
            </button>
            <button
              class="rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
              :disabled="!canEdit"
              @click="convertCurrentSlide('explanation')"
            >
              转讲解页
            </button>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <select
              v-model="selectedTemplateId"
              class="min-w-0 flex-1 rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs outline-none transition focus:border-[#c49b81]"
              :disabled="!canEdit"
            >
              <option value="">切换模板</option>
              <option
                v-for="template in compatibleTemplates"
                :key="template.id"
                :value="template.id"
              >
                {{ template.label }}
              </option>
            </select>
            <button
              class="rounded-lg bg-accent px-3 py-2 text-xs text-white transition hover:bg-accent-hover disabled:opacity-50"
              :disabled="!canEdit || !selectedTemplateId"
              @click="applySelectedTemplate"
            >
              套用
            </button>
          </div>
          <div v-if="recommendedTemplates.length" class="mt-3">
            <div class="mb-2 text-[11px] font-medium text-text-muted">推荐模板</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="template in recommendedTemplates"
                :key="template.id"
                class="rounded-full border border-border bg-[#fcfcfb] px-3 py-1.5 text-[11px] text-text-secondary transition hover:bg-surface-hover"
                :disabled="!canEdit"
                @click="applyRecommendedTemplate(template.id)"
              >
                {{ template.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-xl border border-border bg-white p-3">
          <div class="mb-2 flex items-center justify-between">
            <div class="text-xs font-medium text-text-secondary">批量调整</div>
            <div class="text-[11px] text-text-muted">已选 {{ props.selectedSlideIndices.length }} 页</div>
          </div>

          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-[11px] font-medium text-text-muted">删除已选页面中的第 N 个元素</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="batchElementPosition"
                  type="number"
                  min="1"
                  class="w-20 rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-sm outline-none transition focus:border-[#c49b81]"
                >
                <button
                  class="rounded-lg border border-[#e2c2b0] bg-[#fff7f1] px-3 py-2 text-xs text-[#b05a36] transition hover:bg-[#fff1e8] disabled:opacity-40"
                  :disabled="!canEdit || props.selectedSlideIndices.length === 0 || batchElementPosition < 1"
                  @click="deleteBatchElementAtPosition"
                >
                  批量删除
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-medium text-text-muted">删除已选页面中的指定区域</label>
              <div class="flex items-center gap-2">
                <select
                  v-model="batchRegionToDelete"
                  class="min-w-0 flex-1 rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-xs outline-none transition focus:border-[#c49b81]"
                >
                  <option
                    v-for="option in regionOptions.filter((option) => option.value)"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <button
                  class="rounded-lg border border-[#e2c2b0] bg-[#fff7f1] px-3 py-2 text-xs text-[#b05a36] transition hover:bg-[#fff1e8] disabled:opacity-40"
                  :disabled="!canEdit || props.selectedSlideIndices.length === 0"
                  @click="deleteBatchRegion"
                >
                  删除区域
                </button>
              </div>
            </div>

            <p class="text-[11px] leading-5 text-text-muted">
              可用于批量删掉所有选择题页里的 `tips`，或统一删除第 4 个元素。
            </p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <div
            v-for="(element, index) in currentSlide.elements"
            :key="`${element.type}-${index}`"
            class="rounded-xl border border-border bg-white p-3"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-medium text-text-secondary">
                {{ elementLabel(element, index) }}
              </span>
              <div class="flex items-center gap-1">
                <span class="text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  {{ element.type }}
                </span>
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary transition hover:bg-surface-hover disabled:opacity-40"
                  :disabled="!canEdit || index === 0"
                  @click="moveElement(index, 'up')"
                >
                  <ArrowUp :size="12" />
                </button>
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary transition hover:bg-surface-hover disabled:opacity-40"
                  :disabled="!canEdit || index >= currentSlide.elements.length - 1"
                  @click="moveElement(index, 'down')"
                >
                  <ArrowDown :size="12" />
                </button>
                <button
                  class="inline-flex h-7 w-7 items-center justify-center rounded border border-[#e2c2b0] text-[#b05a36] transition hover:bg-[#fff1e8] disabled:opacity-40"
                  :disabled="!canEdit"
                  @click="deleteElement(index)"
                >
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>

            <div class="mb-2 grid grid-cols-2 gap-2">
              <label class="block">
                <span class="mb-1 block text-[11px] font-medium text-text-muted">元素类型</span>
                <select
                  :value="element.type"
                  class="w-full rounded-lg border border-border bg-[#fcfcfb] px-2 py-2 text-xs outline-none transition focus:border-[#c49b81]"
                  :disabled="!canEdit"
                  @change="updateElementType(index, ($event.target as HTMLSelectElement).value as SlideElement['type'])"
                >
                  <option
                    v-for="option in elementOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] font-medium text-text-muted">内容区域</span>
                <select
                  :value="element.region || ''"
                  class="w-full rounded-lg border border-border bg-[#fcfcfb] px-2 py-2 text-xs outline-none transition focus:border-[#c49b81]"
                  :disabled="!canEdit"
                  @change="updateElementRegion(index, ($event.target as HTMLSelectElement).value as '' | SlideRegion)"
                >
                  <option
                    v-for="option in regionOptions"
                    :key="option.value || 'default'"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>

            <textarea
              :value="getElementValue(element)"
              class="min-h-[96px] w-full resize-y rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 text-sm outline-none transition focus:border-[#c49b81]"
              :placeholder="element.type === 'list' ? '每行一条' : element.type === 'table' ? '首行为表头，使用 | 分隔列' : ''"
              :disabled="!canEdit"
              @input="updateElementContent(index, ($event.target as HTMLTextAreaElement).value)"
            />

            <p v-if="element.type === 'image'" class="mt-2 text-xs text-text-muted">
              图片暂为占位元素，当前支持编辑 alt 文本，后续再接入图片替换。
            </p>
          </div>
        </div>

        <div class="mt-5 rounded-xl border border-dashed border-border bg-white/70 p-3">
          <div class="mb-2 text-xs font-medium text-text-secondary">新增元素</div>
          <div class="flex items-center gap-2">
            <select
              v-model="newElementType"
              class="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-[#c49b81]"
              :disabled="!canEdit"
            >
              <option
                v-for="option in elementOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <button
              class="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canEdit"
              @click="insertElement"
            >
              <Plus :size="14" />
              添加
            </button>
          </div>
        </div>

        <div class="mt-5 rounded-xl border border-border bg-white p-3">
          <div class="mb-2 text-xs font-medium text-text-secondary">LLM 原始输出排查</div>
          <p class="text-[11px] leading-5 text-text-muted">
            用来确认问题究竟出在模型原始返回，还是出在后续解析/预览。
          </p>

          <details class="mt-3">
            <summary class="cursor-pointer text-xs font-medium text-text-secondary">
              规划阶段原文
            </summary>
            <textarea
              readonly
              :value="llmDebug.planningRaw"
              class="mt-2 min-h-[140px] w-full rounded-lg border border-border bg-[#fcfcfb] px-3 py-2 font-mono text-[11px] leading-5 text-text-secondary outline-none"
              placeholder="本次会话尚未记录到规划阶段原文。"
            />
          </details>

          <details class="mt-3">
            <summary class="cursor-pointer text-xs font-medium text-text-secondary">
              内容阶段原文
            </summary>
            <div class="mt-2 space-y-3">
              <div
                v-for="(batch, batchIndex) in llmDebug.contentBatches"
                :key="`${batch.label}-${batchIndex}`"
                class="rounded-lg border border-border bg-[#fcfcfb] p-2"
              >
                <div class="mb-2 text-[11px] font-medium text-text-muted">
                  {{ batch.label || `第 ${batchIndex + 1} 批` }}
                </div>
                <textarea
                  readonly
                  :value="batch.raw"
                  class="min-h-[180px] w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-[11px] leading-5 text-text-secondary outline-none"
                />
              </div>
              <div
                v-if="llmDebug.contentBatches.length === 0"
                class="rounded-lg border border-dashed border-border bg-[#fcfcfb] px-3 py-4 text-[11px] text-text-muted"
              >
                本次会话尚未记录到内容阶段原文。
              </div>
            </div>
          </details>
        </div>

        <div class="mt-5 rounded-xl border border-border bg-white p-3">
          <div class="mb-2 text-xs font-medium text-text-secondary">附件解析调试</div>
          <p class="text-[11px] leading-5 text-text-muted">
            重点看 `extractedText`、`planningSummary`、`contentSummary` 里第 6 题跨页处是否已经断裂。
          </p>

          <div class="mt-3 space-y-3">
            <details
              v-for="attachment in debugAttachments"
              :key="attachment.id"
              class="rounded-lg border border-border bg-[#fcfcfb] p-3"
            >
              <summary class="cursor-pointer text-xs font-medium text-text-secondary">
                {{ attachment.fileName }} · {{ attachment.fileType }}
              </summary>

              <div class="mt-3 space-y-3">
                <div v-if="attachment.classification" class="text-[11px] text-text-muted">
                  分类：{{ attachment.classification }}
                </div>

                <div>
                  <div class="mb-1 text-[11px] font-medium text-text-muted">extractedText</div>
                  <textarea
                    readonly
                    :value="attachment.extractedText || ''"
                    class="min-h-[180px] w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-[11px] leading-5 text-text-secondary outline-none"
                    placeholder="无 extractedText"
                  />
                </div>

                <div>
                  <div class="mb-1 text-[11px] font-medium text-text-muted">planningSummary</div>
                  <textarea
                    readonly
                    :value="attachment.planningSummary || ''"
                    class="min-h-[100px] w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-[11px] leading-5 text-text-secondary outline-none"
                    placeholder="无 planningSummary"
                  />
                </div>

                <div>
                  <div class="mb-1 text-[11px] font-medium text-text-muted">contentSummary</div>
                  <textarea
                    readonly
                    :value="attachment.contentSummary || ''"
                    class="min-h-[140px] w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-[11px] leading-5 text-text-secondary outline-none"
                    placeholder="无 contentSummary"
                  />
                </div>
              </div>
            </details>

            <div
              v-if="debugAttachments.length === 0"
              class="rounded-lg border border-dashed border-border bg-[#fcfcfb] px-3 py-4 text-[11px] text-text-muted"
            >
              当前会话没有可调试的文本附件。
            </div>
          </div>
        </div>
      </template>

      <div v-else class="text-sm text-text-muted">
        先生成课件，或新增一个页面。
      </div>
    </div>

    <div class="border-t px-4 py-3">
      <div class="mb-3 grid grid-cols-2 gap-2">
        <button
          class="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canEdit || currentSlideIndex === 0"
          @click="moveCurrentSlide('up')"
        >
          <ArrowUp :size="14" />
          上移
        </button>
        <button
          class="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canEdit || currentSlideIndex >= slides.length - 1"
          @click="moveCurrentSlide('down')"
        >
          <ArrowDown :size="14" />
          下移
        </button>
        <button
          class="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-secondary transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canEdit"
          @click="duplicateCurrentSlide"
        >
          <Copy :size="14" />
          复制
        </button>
        <button
          class="inline-flex items-center justify-center gap-1 rounded-lg border border-[#e2c2b0] bg-[#fff7f2] px-3 py-2 text-xs text-[#b05a36] transition hover:bg-[#fff1e8] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canEdit || slides.length === 0"
          @click="deleteCurrentSlide"
        >
          <Trash2 :size="14" />
          删除
        </button>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="newSlideKind"
          class="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-[#c49b81]"
          :disabled="editorStore.isGenerating"
        >
          <option
            v-for="option in kindOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <button
          class="inline-flex items-center justify-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="editorStore.isGenerating"
          @click="insertSlide"
        >
          <Plus :size="14" />
          新增
        </button>
      </div>
    </div>
  </aside>
</template>
