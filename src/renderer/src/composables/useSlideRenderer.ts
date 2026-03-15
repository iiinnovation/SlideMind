import { ref, computed, watch, type Ref, onBeforeUnmount } from 'vue'
import type { Slide, SlideElement } from '../../../shared/types/slide'
import newLessonCSS from '@themes/css/new-lesson.css?raw'
import mistakeReviewCSS from '@themes/css/mistake-review.css?raw'

const THEME_CSS_MAP: Record<string, string> = {
  'new-lesson': newLessonCSS,
  'mistake-review': mistakeReviewCSS
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

function renderSlideToHTML(slide: Slide): string {
  const cls = slide.layout !== 'content' ? ` class="${slide.layout}"` : ''
  let html = `<section${cls}>`

  if (slide.title) html += `<h1>${escapeHtml(slide.title)}</h1>`
  if (slide.subtitle) html += `<h2>${escapeHtml(slide.subtitle)}</h2>`

  for (const el of slide.elements) {
    switch (el.type) {
      case 'heading':
        html += `<h${el.level}>${escapeHtml(el.content)}</h${el.level}>`
        break
      case 'text':
        html += `<p>${renderInlineFormatting(el.content)}</p>`
        break
      case 'list': {
        const tag = el.ordered ? 'ol' : 'ul'
        html += `<${tag}>${el.items.map((i) => `<li>${renderInlineFormatting(i)}</li>`).join('')}</${tag}>`
        break
      }
      case 'blockquote':
        html += `<blockquote><p>${escapeHtml(el.content)}</p></blockquote>`
        break
      case 'table':
        html += renderTable(el)
        break
      case 'image':
        html += `<div class="slide-image"><img src="${el.src}" alt="${escapeHtml(el.alt || '')}" /></div>`
        break
    }
  }

  html += '</section>'
  return html
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function useSlideRenderer(
  slides: Ref<Slide[]>,
  theme: Ref<string>,
  isStreaming: Ref<boolean>
) {
  const renderedSlides = ref<string[]>([])
  const renderedCSS = ref('')
  const currentSlide = ref(0)
  const totalSlides = ref(0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let userNavigatedDuringStream = false

  function render() {
    // Update CSS based on theme
    renderedCSS.value = THEME_CSS_MAP[theme.value] || THEME_CSS_MAP['new-lesson'] || ''

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
    [slides, theme],
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
