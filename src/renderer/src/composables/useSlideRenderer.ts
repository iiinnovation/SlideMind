import { ref, computed, watch, type Ref, onBeforeUnmount } from 'vue'
import { EXPORT_LAYOUT_LIMITS } from '../../../shared/constants'
import type { Slide, SlideElement } from '../../../shared/types/slide'
import type { PresentationTypographySettings } from '../../../shared/types/settings'
import { getSlideTemplate } from '../../../shared/templates'
import newLessonCSS from '@themes/css/new-lesson.css?raw'
import mistakeReviewCSS from '@themes/css/mistake-review.css?raw'

const THEME_CSS_MAP: Record<string, string> = {
  'new-lesson': newLessonCSS,
  'mistake-review': mistakeReviewCSS
}

const REGION_LABELS: Partial<Record<NonNullable<SlideElement['region']>, string>> = {
  hero: '导语',
  lead: '概览',
  body: '内容',
  question: '题干',
  options: '选项',
  material: '材料',
  analysis: '错误原因',
  answer: '正确解法',
  tips: '易错提醒',
  summary: '总结',
  footer: '备注'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInlineFormatting(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function renderTable(el: Extract<SlideElement, { type: 'table' }>): string {
  let html = '<table>'
  html += '<thead><tr>'
  for (const header of el.headers) {
    html += `<th>${escapeHtml(header)}</th>`
  }
  html += '</tr></thead>'
  html += '<tbody>'
  for (const row of el.rows) {
    html += '<tr>'
    for (const cell of row) {
      html += `<td>${escapeHtml(cell)}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table>'
  return html
}

function renderElementToHTML(el: SlideElement): string {
  switch (el.type) {
    case 'heading':
      return `<h${el.level}>${escapeHtml(el.content)}</h${el.level}>`
    case 'text':
      return `<p>${renderInlineFormatting(el.content)}</p>`
    case 'list': {
      const tag = el.ordered ? 'ol' : 'ul'
      return `<${tag}>${el.items.map((i) => `<li>${renderInlineFormatting(i)}</li>`).join('')}</${tag}>`
    }
    case 'blockquote':
      return `<blockquote><p>${escapeHtml(el.content)}</p></blockquote>`
    case 'table':
      return renderTable(el)
    case 'image':
      return `<div class="slide-image"><img src="${el.src}" alt="${escapeHtml(el.alt || '')}" /></div>`
  }
}

function extractChoiceAnswerLabel(elements: SlideElement[]): string | null {
  for (const element of elements) {
    const content =
      element.type === 'text' || element.type === 'blockquote' || element.type === 'heading'
        ? element.content
        : element.type === 'list'
          ? element.items.join(' ')
          : ''
    const match = content.match(/(?:正确答案|答案|选)(?:[:：\s])*([A-D])/i)
    if (match?.[1]) {
      return match[1].toUpperCase()
    }
  }
  return null
}

function renderChoiceOptionsHTML(elements: SlideElement[], answerLabel: string | null): string {
  return elements
    .map((element) => {
      if (element.type !== 'list') {
        return renderElementToHTML(element)
      }

      const tag = element.ordered ? 'ol' : 'ul'
      const items = element.items
        .map((item) => {
          const optionMatch = item.trim().match(/^([A-D])[.．、:\s]/i)
          const isCorrect = answerLabel && optionMatch?.[1]?.toUpperCase() === answerLabel
          const content = renderInlineFormatting(item)
          return isCorrect
            ? `<li><span class="choice-correct-text">${content}</span></li>`
            : `<li>${content}</li>`
        })
        .join('')
      return `<${tag}>${items}</${tag}>`
    })
    .join('')
}

function renderSlideToHTML(slide: Slide): string {
  const classes = [slide.layout]
  if (slide.kind) classes.push(slide.kind)
  if (isStructuredSlide(slide)) classes.push('preview-flow')
  const template = getSlideTemplate(slide.templateId)
  if (template?.previewClass) classes.push(template.previewClass)
  let html = `<section class="${classes.join(' ')}" data-layout="${slide.layout}"`
  if (slide.kind) {
    html += ` data-kind="${slide.kind}"`
  }
  if (slide.templateId) {
    html += ` data-template-id="${slide.templateId}"`
  }
  html += '>'

  if (slide.title) html += `<h1>${escapeHtml(slide.title)}</h1>`
  if (slide.subtitle) html += `<h2>${escapeHtml(slide.subtitle)}</h2>`

  if (isStructuredSlide(slide)) {
    html += renderStructuredRegions(slide)
  } else {
    for (const el of slide.elements) {
      html += renderRegionWrapper(el.region, renderElementToHTML(el))
    }
  }

  html += '</section>'
  return html
}

function renderRegionWrapper(region: SlideElement['region'], inner: string): string {
  if (!region) return inner
  const label = REGION_LABELS[region] || region
  return `<div class="region region-${region}" data-region="${region}" data-region-label="${label}">${inner}</div>`
}

function isStructuredSlide(slide: Slide): boolean {
  return Boolean(
    slide.kind &&
    ['question-answer', 'question-choice', 'question-material'].includes(slide.kind)
  )
}

function renderStructuredRegions(slide: Slide): string {
  if (!slide.kind || !isStructuredSlide(slide)) return ''
  const order = EXPORT_LAYOUT_LIMITS.structuredRegionPriority[slide.kind]
  const regionGroups = new Map<string, SlideElement[]>()
  const answerLabel = slide.kind === 'question-choice'
    ? extractChoiceAnswerLabel(slide.elements.filter((element) => element.region === 'answer'))
    : null

  for (const element of slide.elements) {
    const key = element.region ?? 'body'
    const list = regionGroups.get(key) ?? []
    list.push(element)
    regionGroups.set(key, list)
  }

  const orderedRegions = [
    ...order.filter((region) => regionGroups.has(region)),
    ...Array.from(regionGroups.keys()).filter((region) => !order.includes(region as never))
  ]

  return orderedRegions
    .map((region) => {
      const elements = regionGroups.get(region) ?? []
      const inner = slide.kind === 'question-choice' && region === 'options'
        ? renderChoiceOptionsHTML(elements, answerLabel)
        : elements.map(renderElementToHTML).join('')
      return renderRegionWrapper(region as SlideElement['region'], inner)
    })
    .join('')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function useSlideRenderer(
  slides: Ref<Slide[]>,
  theme: Ref<string>,
  isStreaming: Ref<boolean>,
  typography: Ref<PresentationTypographySettings>
) {
  const renderedSlides = ref<string[]>([])
  const renderedCSS = ref('')
  const currentSlide = ref(0)
  const totalSlides = ref(0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let userNavigatedDuringStream = false

  function render() {
    // Update CSS based on theme
    const themeCSS = THEME_CSS_MAP[theme.value] || THEME_CSS_MAP['new-lesson'] || ''
    renderedCSS.value = [
      ':host {',
      `  --slide-title-font-family: '${typography.value.titleFontFamily}', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;`,
      `  --slide-body-font-family: '${typography.value.bodyFontFamily}', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;`,
      `  --slide-title-font-size: ${typography.value.titleFontSize}px;`,
      `  --slide-body-font-size: ${typography.value.bodyFontSize}px;`,
      '}',
      themeCSS
    ].join('\n')

    // Render all slides to HTML
    const newSlides = slides.value.map(renderSlideToHTML)

    // Slide-level diff
    const oldSlides = renderedSlides.value
    let changed = oldSlides.length !== newSlides.length
    if (!changed) {
      for (let i = 0; i < newSlides.length; i++) {
        if (oldSlides[i] !== newSlides[i]) {
          changed = true
          break
        }
      }
    }

    if (changed) {
      renderedSlides.value = newSlides
      totalSlides.value = newSlides.length
    }

    // Auto-track to last slide during streaming
    if (isStreaming.value && !userNavigatedDuringStream && newSlides.length > 0) {
      currentSlide.value = newSlides.length - 1
    } else if (currentSlide.value >= newSlides.length) {
      currentSlide.value = Math.max(0, newSlides.length - 1)
    }
  }

  function scheduleRender() {
    if (debounceTimer) clearTimeout(debounceTimer)

    let delay: number
    if (isStreaming.value) {
      delay = 200
    } else {
      delay = 16
    }

    debounceTimer = setTimeout(render, delay)
  }

  function nextSlide() {
    if (currentSlide.value < totalSlides.value - 1) {
      if (isStreaming.value) userNavigatedDuringStream = true
      currentSlide.value++
    }
  }

  function prevSlide() {
    if (currentSlide.value > 0) {
      if (isStreaming.value) userNavigatedDuringStream = true
      currentSlide.value--
    }
  }

  function goToSlide(index: number) {
    if (index >= 0 && index < totalSlides.value) {
      if (isStreaming.value) userNavigatedDuringStream = true
      currentSlide.value = index
    }
  }

  const currentSlideHTML = computed(() => {
    if (renderedSlides.value.length === 0) return ''
    return renderedSlides.value[currentSlide.value] || ''
  })

  watch(
    [slides, theme, typography],
    () => {
      scheduleRender()
    },
    { immediate: true }
  )

  // When streaming ends: clear timer and do a final immediate render
  watch(isStreaming, (streaming, wasStreaming) => {
    if (wasStreaming && !streaming) {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      render()
      userNavigatedDuringStream = false
    }
    if (streaming && !wasStreaming) {
      userNavigatedDuringStream = false
    }
  })

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  return {
    renderedSlides,
    renderedCSS,
    currentSlide,
    currentSlideHTML,
    totalSlides,
    nextSlide,
    prevSlide,
    goToSlide
  }
}
