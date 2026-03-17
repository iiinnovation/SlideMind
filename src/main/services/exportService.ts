import PptxGenJS from 'pptxgenjs'
import { writeFile } from 'fs/promises'
import { newLessonPptxTheme, type PptxThemeConfig } from '../../themes/pptx/new-lesson'
import { mistakeReviewPptxTheme } from '../../themes/pptx/mistake-review'
import type { Slide, SlideElement, SlideKind, SlideRegion } from '../../shared/types/slide'
import type { PresentationTypographySettings } from '../../shared/types/settings'
import { EXPORT_LAYOUT_LIMITS } from '../../shared/constants'
import { getSlideTemplate } from '../../shared/templates'

const PPTX_THEME_MAP: Record<string, PptxThemeConfig> = {
  'new-lesson': newLessonPptxTheme,
  'mistake-review': mistakeReviewPptxTheme
}

type StructuredQuestionKind = keyof typeof STRUCTURED_REGION_BOXES
type BulletOptions = NonNullable<PptxGenJS.TextPropsOptions['bullet']>

const STRUCTURED_QUESTION_KINDS = new Set<StructuredQuestionKind>([
  'question-choice',
  'question-material',
  'question-answer'
])

const SLIDE_CONTENT_MAX_Y = EXPORT_LAYOUT_LIMITS.slideContentMaxY
const MIN_FONT_SCALE = EXPORT_LAYOUT_LIMITS.minFontScale
const STRUCTURED_REGION_BOXES = {
  'question-material': {
    material: { x: 0.6, y: 0, w: 4.2, h: 5.6 },
    question: { x: 5.05, y: 0, w: 6.75, h: 1.4 },
    analysis: { x: 5.05, y: 1.6, w: 3.2, h: 2.1 },
    answer: { x: 8.6, y: 1.6, w: 3.2, h: 2.1 },
    tips: { x: 5.05, y: 3.95, w: 6.75, h: 1.65 }
  },
  'question-choice': {
    question: { x: 0.6, y: 0, w: 11.2, h: 1.25 },
    options: { x: 0.6, y: 1.5, w: 6.8, h: 4.15 },
    answer: { x: 7.7, y: 1.5, w: 4.1, h: 2.05 },
    tips: { x: 7.7, y: 3.8, w: 4.1, h: 1.85 }
  },
  'question-answer': {
    question: { x: 0.6, y: 0, w: 11.2, h: 1.2 },
    analysis: { x: 0.6, y: 1.45, w: 3.45, h: 4.1 },
    answer: { x: 4.2, y: 1.45, w: 4.2, h: 4.1 },
    tips: { x: 8.6, y: 1.45, w: 3.2, h: 4.1 }
  }
} as const

const GENERIC_MAX_LIST_ITEMS: Partial<Record<SlideKind, number>> = EXPORT_LAYOUT_LIMITS.genericMaxListItems
const STRUCTURED_REGION_PRIORITY: Record<
  keyof typeof STRUCTURED_REGION_BOXES,
  SlideRegion[]
> = {
  'question-material': [...EXPORT_LAYOUT_LIMITS.structuredRegionPriority['question-material']],
  'question-choice': [...EXPORT_LAYOUT_LIMITS.structuredRegionPriority['question-choice']],
  'question-answer': [...EXPORT_LAYOUT_LIMITS.structuredRegionPriority['question-answer']]
}

export async function exportToPptx(
  slides: Slide[],
  themeName: string,
  outputPath: string,
  typography: PresentationTypographySettings
): Promise<void> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'SlideMind'
  pptx.company = 'SlideMind'
  pptx.subject = 'AI-generated teaching slides'
  pptx.title = 'SlideMind Export'

  const theme = applyTypographyToTheme(
    PPTX_THEME_MAP[themeName] || newLessonPptxTheme,
    typography
  )

  const exportSlides = preprocessSlidesForExport(slides, theme)

  for (const slide of exportSlides) {
    const pptxSlide = pptx.addSlide()
    const slideClass = resolveSlideClass(slide)
    applySlideTheme(pptxSlide, theme, slideClass)
    renderSlideContent(pptxSlide, slide, theme, slideClass)
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  await writeFile(outputPath, buffer)
}

function applyTypographyToTheme(
  theme: PptxThemeConfig,
  typography: PresentationTypographySettings
): PptxThemeConfig {
  const titleScale = typography.titleFontSize / 28
  const bodyScale = typography.bodyFontSize / 16

  function patchTextProps<T extends Partial<PptxGenJS.TextPropsOptions>>(
    props: T,
    config: { fontFace: string; scale: number }
  ): T {
    return {
      ...props,
      fontFace: config.fontFace,
      fontSize: typeof props.fontSize === 'number'
        ? Math.round(props.fontSize * config.scale * 10) / 10
        : props.fontSize
    }
  }

  const classOverrides = theme.classOverrides
    ? Object.fromEntries(
        Object.entries(theme.classOverrides).map(([key, override]) => [
          key,
          {
            ...override,
            title: override.title
              ? patchTextProps(override.title, { fontFace: typography.titleFontFamily, scale: titleScale })
              : override.title,
            subtitle: override.subtitle
              ? patchTextProps(override.subtitle, { fontFace: typography.titleFontFamily, scale: titleScale })
              : override.subtitle,
            body: override.body
              ? patchTextProps(override.body, { fontFace: typography.bodyFontFamily, scale: bodyScale })
              : override.body,
            bullet: override.bullet
              ? patchTextProps(override.bullet, { fontFace: typography.bodyFontFamily, scale: bodyScale })
              : override.bullet
          }
        ])
      )
    : undefined

  return {
    ...theme,
    title: patchTextProps(theme.title, { fontFace: typography.titleFontFamily, scale: titleScale }),
    subtitle: patchTextProps(theme.subtitle, { fontFace: typography.titleFontFamily, scale: titleScale }),
    body: patchTextProps(theme.body, { fontFace: typography.bodyFontFamily, scale: bodyScale }),
    bullet: patchTextProps(theme.bullet, { fontFace: typography.bodyFontFamily, scale: bodyScale }),
    classOverrides
  }
}

function resolvePreset(
  theme: PptxThemeConfig,
  slideClass: string | null,
  key: 'title' | 'subtitle' | 'body' | 'bullet'
): typeof theme.title {
  const base = theme[key]
  if (!slideClass || !theme.classOverrides?.[slideClass]) {
    return base
  }
  const override = theme.classOverrides[slideClass][key]
  if (!override) return base
  return { ...base, ...override }
}

function applySlideTheme(
  pptxSlide: PptxGenJS.Slide,
  theme: PptxThemeConfig,
  slideClass: string | null
): void {
  if (slideClass && theme.classOverrides?.[slideClass]?.background) {
    pptxSlide.background = theme.classOverrides[slideClass].background!
  } else {
    pptxSlide.background = theme.background
  }
}

function resolveSlideClass(slide: Slide): string | null {
  const template = getSlideTemplate(slide.templateId)
  return template?.pptxClass || slide.kind || (slide.layout !== 'content' ? slide.layout : null)
}

function stripInlineFormatting(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

function getFontSize(preset: Partial<PptxGenJS.TextPropsOptions>, fallback: number): number {
  return typeof preset.fontSize === 'number' ? preset.fontSize : fallback
}

function estimateVisualLength(text: string): number {
  let length = 0
  for (const char of text) {
    if (char === '\t') {
      length += 2
      continue
    }
    if (/[A-Za-z0-9]/.test(char)) {
      length += 0.6
      continue
    }
    if (/\s/.test(char)) {
      length += 0.35
      continue
    }
    length += 1
  }
  return length
}

function estimateTextHeight(
  text: string,
  width: number,
  fontSize: number,
  options: { minLines?: number; paragraphGapLines?: number } = {}
): number {
  const minLines = options.minLines ?? 1
  const paragraphGapLines = options.paragraphGapLines ?? 0.35
  const charsPerLine = Math.max(8, Math.floor((width * 72) / fontSize))
  const paragraphs = text
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    return Math.max(minLines, 1) * fontSize * 0.019
  }

  let lineCount = 0
  for (const paragraph of paragraphs) {
    const visualLength = estimateVisualLength(paragraph)
    lineCount += Math.max(1, Math.ceil(visualLength / charsPerLine))
  }

  lineCount += Math.max(0, paragraphs.length - 1) * paragraphGapLines
  return Math.max(lineCount, minLines) * fontSize * 0.019
}

function estimateInlineTextWidth(text: string, fontSize: number): number {
  return Math.max(0.8, estimateVisualLength(stripInlineFormatting(text)) * fontSize * 0.012)
}

function addFittedText(
  pptxSlide: PptxGenJS.Slide,
  text: string,
  box: { x: number; y: number; w: number },
  preset: Partial<PptxGenJS.TextPropsOptions>,
  fallbackFontSize: number,
  options: {
    minLines?: number
    paragraphGapLines?: number
    margin?: number
    breakLine?: boolean
    bullet?: BulletOptions
  } = {}
): number {
  const normalized = stripInlineFormatting(text).replace(/\r\n/g, '\n').trim()
  const fontSize = getFontSize(preset, fallbackFontSize)
  const height = estimateTextHeight(normalized, box.w, fontSize, options)

  pptxSlide.addText(normalized, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: height,
    fit: 'shrink',
    valign: 'top',
    margin: options.margin ?? 0,
    breakLine: options.breakLine ?? false,
    bullet: options.bullet,
    ...preset
  })

  return height
}

function scaleTextPreset<T extends Partial<PptxGenJS.TextPropsOptions>>(preset: T, scale: number): T {
  if (scale >= 0.999) return preset
  return {
    ...preset,
    fontSize: typeof preset.fontSize === 'number'
      ? Math.max(8, Math.round(preset.fontSize * scale * 10) / 10)
      : preset.fontSize
  }
}

function clampFontScale(requiredScale: number): number {
  if (!Number.isFinite(requiredScale)) return 1
  return Math.max(MIN_FONT_SCALE, Math.min(1, requiredScale))
}

function preprocessSlidesForExport(slides: Slide[], theme: PptxThemeConfig): Slide[] {
  return slides.flatMap((slide) => {
    if (isStructuredQuestionKind(slide.kind) && slide.elements.some((element) => element.region)) {
      return splitStructuredSlide(slide, theme)
    }

    return splitGenericSlide(slide, theme)
  })
}

function isStructuredQuestionKind(kind: Slide['kind']): kind is StructuredQuestionKind {
  return typeof kind === 'string' && STRUCTURED_QUESTION_KINDS.has(kind as StructuredQuestionKind)
}

function splitStructuredSlide(slide: Slide, theme: PptxThemeConfig): Slide[] {
  if (!isStructuredQuestionKind(slide.kind)) {
    return [slide]
  }

  const structuredKind = slide.kind
  const regions = groupElementsByRegion(slide.elements)
  const boxes = STRUCTURED_REGION_BOXES[structuredKind]
  const repeatedRegions = new Set<SlideRegion>(
    structuredKind === 'question-material'
      ? ['question']
      : ['question']
  )

  const chunkedByRegion: Partial<Record<SlideRegion, SlideElement[][]>> = {}
  let maxChunks = 1
  const orderedRegions = STRUCTURED_REGION_PRIORITY[structuredKind] as Array<keyof typeof boxes & SlideRegion>

  for (const region of orderedRegions) {
      const box = boxes[region]
    const elements = regions[region]
    if (!elements || elements.length === 0) continue
    const chunks = repeatedRegions.has(region)
      ? [elements]
      : splitElementsIntoChunks(elements, box.w - 0.44, Math.max(0.6, box.h - 0.74), theme, {
          maxListItemsPerChunk: region === 'question' ? 3 : undefined
        })
    chunkedByRegion[region] = chunks
    if (!repeatedRegions.has(region)) {
      maxChunks = Math.max(maxChunks, chunks.length)
    }
  }

  const pages: Slide[] = []
  for (let chunkIndex = 0; chunkIndex < maxChunks; chunkIndex++) {
    const pageElements: SlideElement[] = []

    for (const region of orderedRegions) {
      const chunks = chunkedByRegion[region]
      if (!chunks || chunks.length === 0) continue

      const selected = repeatedRegions.has(region)
        ? chunks[0]
        : chunks[chunkIndex]

      if (selected && selected.length > 0) {
        pageElements.push(...selected)
      }
    }

    const hasNonQuestionContent = pageElements.some((element) => element.region && element.region !== 'question')
    if (pageElements.length === 0 || (!hasNonQuestionContent && chunkIndex > 0)) {
      continue
    }

    pages.push(makeContinuationSlide(slide, pageElements, chunkIndex))
  }

  return pages.length > 0 ? pages : [slide]
}

function splitGenericSlide(slide: Slide, theme: PptxThemeConfig): Slide[] {
  const slideClass = slide.kind || (slide.layout !== 'content' ? slide.layout : null)
  const titlePreset = resolvePreset(theme, slideClass, 'title')
  const subtitlePreset = resolvePreset(theme, slideClass, 'subtitle')
  let titleHeight = 0

  if (slide.title) {
    titleHeight += estimateTextHeight(stripInlineFormatting(slide.title), 11.2, getFontSize(titlePreset, 36), {
      minLines: 1,
      paragraphGapLines: 0.2
    }) + 0.22
  }

  if (slide.subtitle) {
    titleHeight += estimateTextHeight(stripInlineFormatting(slide.subtitle), 11.2, getFontSize(subtitlePreset, 24), {
      minLines: 1,
      paragraphGapLines: 0.25
    }) + 0.16
  }

  const availableHeight = Math.max(1.2, SLIDE_CONTENT_MAX_Y - (0.6 + titleHeight))
  const maxListItemsPerChunk = slide.kind ? GENERIC_MAX_LIST_ITEMS[slide.kind] : undefined
  const elementChunks = splitElementsIntoChunks(slide.elements, 11, availableHeight, theme, {
    maxListItemsPerChunk
  })

  return elementChunks.map((elements, index) => makeContinuationSlide(slide, elements, index))
}

function splitElementsIntoChunks(
  elements: SlideElement[],
  width: number,
  availableHeight: number,
  theme: PptxThemeConfig,
  options: { maxListItemsPerChunk?: number } = {}
): SlideElement[][] {
  const chunks: SlideElement[][] = []
  let currentChunk: SlideElement[] = []
  let currentHeight = 0

  const pushChunk = () => {
    if (currentChunk.length === 0) return
    chunks.push(currentChunk)
    currentChunk = []
    currentHeight = 0
  }

  for (const element of elements) {
    if (element.type === 'list') {
      const listChunks = splitListElement(element, width, availableHeight, theme, options.maxListItemsPerChunk)
      for (const listChunk of listChunks) {
        const nextHeight = estimateElementHeight(listChunk, width, theme)
        if (currentChunk.length > 0 && currentHeight + nextHeight > availableHeight) {
          pushChunk()
        }
        currentChunk.push(listChunk)
        currentHeight += nextHeight
      }
      continue
    }

    const nextHeight = estimateElementHeight(element, width, theme)
    if (currentChunk.length > 0 && currentHeight + nextHeight > availableHeight) {
      pushChunk()
    }
    currentChunk.push(element)
    currentHeight += nextHeight
  }

  pushChunk()
  return chunks.length > 0 ? chunks : [[]]
}

function splitListElement(
  element: Extract<SlideElement, { type: 'list' }>,
  width: number,
  availableHeight: number,
  theme: PptxThemeConfig,
  maxItemsPerChunk?: number
): Extract<SlideElement, { type: 'list' }>[] {
  const result: Extract<SlideElement, { type: 'list' }>[] = []
  let currentItems: string[] = []
  let currentHeight = 0

  const bodyPreset = resolvePreset(theme, null, 'bullet')
  const fallback = getFontSize(bodyPreset, 16)

  const pushChunk = () => {
    if (currentItems.length === 0) return
    result.push({ ...element, items: currentItems })
    currentItems = []
    currentHeight = 0
  }

  for (const item of element.items) {
    const itemHeight = estimateTextHeight(stripInlineFormatting(item), width, fallback, {
      minLines: 1,
      paragraphGapLines: 0.35
    }) + 0.08

    const nextCount = currentItems.length + 1
    const hitItemLimit = typeof maxItemsPerChunk === 'number' && nextCount > maxItemsPerChunk
    if (currentItems.length > 0 && (currentHeight + itemHeight > availableHeight || hitItemLimit)) {
      pushChunk()
    }

    currentItems.push(item)
    currentHeight += itemHeight
  }

  pushChunk()
  return result.length > 0 ? result : [{ ...element, items: element.items.slice(0, 1) }]
}

function estimateElementHeight(
  element: SlideElement,
  width: number,
  theme: PptxThemeConfig
): number {
  switch (element.type) {
    case 'heading': {
      const preset = resolvePreset(theme, null, 'subtitle')
      return estimateTextHeight(stripInlineFormatting(element.content), width, getFontSize(preset, 24), {
        minLines: 1,
        paragraphGapLines: 0.2
      }) + 0.14
    }
    case 'text':
    case 'blockquote': {
      const preset = resolvePreset(theme, null, 'body')
      return estimateTextHeight(stripInlineFormatting(element.content), width, getFontSize(preset, 18), {
        minLines: 1,
        paragraphGapLines: element.type === 'blockquote' ? 0.45 : 0.5
      }) + 0.12
    }
    case 'list': {
      const preset = resolvePreset(theme, null, 'bullet')
      return element.items.reduce((total, item) => {
        return total + estimateTextHeight(stripInlineFormatting(item), width, getFontSize(preset, 16), {
          minLines: 1,
          paragraphGapLines: 0.35
        }) + 0.08
      }, 0.04)
    }
    case 'table':
      return 0.5 * ([element.headers, ...element.rows].length + 1)
    case 'image':
      return 4.7
    default:
      return 0
  }
}

function makeContinuationSlide(slide: Slide, elements: SlideElement[], index: number): Slide {
  return {
    ...slide,
    title: appendContinuationSuffix(slide.title, index),
    elements
  }
}

function appendContinuationSuffix(title: string | undefined, continuationIndex: number): string | undefined {
  if (!title || continuationIndex === 0) return title
  return continuationIndex === 1
    ? `${title}（续）`
    : `${title}（续${continuationIndex}）`
}

function resolveGenericContentScale(
  slide: Slide,
  theme: PptxThemeConfig,
  slideClass: string | null
): number {
  let titleHeight = 0

  if (slide.title) {
    const titlePreset = resolvePreset(theme, slideClass, 'title')
    titleHeight += estimateTextHeight(stripInlineFormatting(slide.title), 11.2, getFontSize(titlePreset, 36), {
      minLines: 1,
      paragraphGapLines: 0.2
    }) + 0.22
  }

  if (slide.subtitle) {
    const subtitlePreset = resolvePreset(theme, slideClass, 'subtitle')
    titleHeight += estimateTextHeight(stripInlineFormatting(slide.subtitle), 11.2, getFontSize(subtitlePreset, 24), {
      minLines: 1,
      paragraphGapLines: 0.25
    }) + 0.16
  }

  const availableHeight = Math.max(1.2, SLIDE_CONTENT_MAX_Y - (0.6 + titleHeight))
  const estimatedHeight = slide.elements.reduce((sum, element) => sum + estimateElementHeight(element, 11, theme), 0)
  if (estimatedHeight <= 0 || estimatedHeight <= availableHeight) return 1
  return clampFontScale(availableHeight / estimatedHeight)
}

function estimateRegionContentHeight(
  elements: SlideElement[],
  width: number,
  theme: PptxThemeConfig
): number {
  return elements.reduce((sum, element) => sum + estimateElementHeight(element, width, theme), 0)
}

function resolveRegionContentScale(
  elements: SlideElement[],
  box: { x: number; y: number; w: number; h: number },
  theme: PptxThemeConfig
): number {
  const estimatedHeight = estimateRegionContentHeight(elements, box.w - 0.44, theme)
  const availableHeight = Math.max(0.5, box.h - 0.74)
  if (estimatedHeight <= 0 || estimatedHeight <= availableHeight) return 1
  return clampFontScale(availableHeight / estimatedHeight)
}

function renderSlideContent(
  pptxSlide: PptxGenJS.Slide,
  slide: Slide,
  theme: PptxThemeConfig,
  slideClass: string | null
): void {
  let yPosition = 0.6
  const contentScale = resolveGenericContentScale(slide, theme, slideClass)

  if (slide.title) {
    const preset = scaleTextPreset(resolvePreset(theme, slideClass, 'title'), contentScale)
    const height = addFittedText(
      pptxSlide,
      slide.title,
      { x: 0.6, y: yPosition, w: 11.2 },
      preset,
      36 * contentScale,
      { minLines: 1, paragraphGapLines: 0.2 }
    )
    yPosition += height + 0.22
  }

  if (slide.subtitle) {
    const preset = scaleTextPreset(resolvePreset(theme, slideClass, 'subtitle'), contentScale)
    const height = addFittedText(
      pptxSlide,
      slide.subtitle,
      { x: 0.6, y: yPosition, w: 11.2 },
      preset,
      24 * contentScale,
      { minLines: 1, paragraphGapLines: 0.25 }
    )
    yPosition += height + 0.16
  }

  if (
    isStructuredQuestionKind(slide.kind) &&
    slide.elements.some((element) => element.region)
  ) {
    renderStructuredQuestionSlide(pptxSlide, slide, theme, slideClass, yPosition)
    return
  }

  for (const el of slide.elements) {
    yPosition = renderElement(pptxSlide, el, theme, slideClass, yPosition, contentScale)
  }
}

function renderStructuredQuestionSlide(
  pptxSlide: PptxGenJS.Slide,
  slide: Slide,
  theme: PptxThemeConfig,
  slideClass: string | null,
  startY: number
): void {
  const regions = groupElementsByRegion(slide.elements)
  const correctOptionLabel = slide.kind === 'question-choice'
    ? extractChoiceAnswerLabel(regions.answer)
    : null

  if (slide.kind === 'question-material') {
    renderRegionCard(
      pptxSlide,
      regions.material,
      { x: 0.6, y: startY, w: 4.2, h: 5.6 },
      '材料',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.question,
      { x: 5.05, y: startY, w: 6.75, h: 1.4 },
      '题干',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.analysis,
      { x: 5.05, y: startY + 1.6, w: 3.2, h: 2.1 },
      '错误原因',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.answer,
      { x: 8.6, y: startY + 1.6, w: 3.2, h: 2.1 },
      '正确解法',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.tips,
      { x: 5.05, y: startY + 3.95, w: 6.75, h: 1.65 },
      '易错提醒',
      theme,
      slideClass
    )
    return
  }

  if (slide.kind === 'question-choice') {
    renderChoicePreviewStyleSlide(
      pptxSlide,
      {
        question: regions.question,
        options: regions.options,
        tips: regions.tips
      },
      theme,
      slideClass,
      startY,
      correctOptionLabel
    )
    return
  }

  renderRegionCard(
    pptxSlide,
    regions.question,
    { x: 0.6, y: startY, w: 11.2, h: 1.2 },
    '题干',
    theme,
    slideClass
  )
  renderRegionCard(
    pptxSlide,
    regions.analysis,
    { x: 0.6, y: startY + 1.45, w: 3.45, h: 4.1 },
    '错误原因',
    theme,
    slideClass
  )
  renderRegionCard(
    pptxSlide,
    regions.answer,
    { x: 4.2, y: startY + 1.45, w: 4.2, h: 4.1 },
    '正确解法',
    theme,
    slideClass
  )
  renderRegionCard(
    pptxSlide,
    regions.tips,
    { x: 8.6, y: startY + 1.45, w: 3.2, h: 4.1 },
    '易错提醒',
    theme,
    slideClass
  )
}

function renderChoicePreviewStyleSlide(
  pptxSlide: PptxGenJS.Slide,
  regions: {
    question: SlideElement[]
    options: SlideElement[]
    tips: SlideElement[]
  },
  theme: PptxThemeConfig,
  slideClass: string | null,
  startY: number,
  correctOptionLabel: string | null
): void {
  const bodyPreset = resolvePreset(theme, slideClass, 'body')
  const bulletPreset = resolvePreset(theme, slideClass, 'bullet')
  const questionScale = resolveRegionContentScale(
    [...regions.question, ...regions.options],
    { x: 0.8, y: startY, w: 10.7, h: 5.2 },
    theme
  )
  const scaledBodyPreset = scaleTextPreset(bodyPreset, questionScale)
  const scaledBulletPreset = scaleTextPreset(bulletPreset, questionScale)

  let y = startY + 0.08
  const contentX = 0.82
  const contentW = 10.55

  for (const element of regions.question) {
    switch (element.type) {
      case 'heading':
      case 'text':
      case 'blockquote': {
        const content = element.content
        const height = addFittedText(
          pptxSlide,
          content,
          { x: contentX, y, w: contentW },
          scaledBodyPreset,
          18 * questionScale,
          { minLines: 1, paragraphGapLines: 0.42, margin: 0.01 }
        )
        y += height + 0.16
        break
      }
      case 'list': {
        for (const item of element.items) {
          const height = addFittedText(
            pptxSlide,
            item,
            { x: contentX + 0.08, y, w: contentW - 0.08 },
            scaledBodyPreset,
            17 * questionScale,
            { minLines: 1, paragraphGapLines: 0.35, margin: 0.01, bullet: { indent: 14 } }
          )
          y += height + 0.08
        }
        y += 0.06
        break
      }
      case 'table':
      case 'image':
        y = renderElement(pptxSlide, element, theme, slideClass, y, questionScale)
        break
    }
  }

  for (const element of regions.options) {
    if (element.type !== 'list') {
      y = renderElement(pptxSlide, element, theme, slideClass, y, questionScale)
      continue
    }

    for (const item of element.items) {
      const optionMatch = item.trim().match(/^([A-D])[.．、:\s]/i)
      const isCorrectOption = Boolean(
        correctOptionLabel &&
        optionMatch?.[1]?.toUpperCase() === correctOptionLabel
      )
      const height = addFittedText(
        pptxSlide,
        item,
        { x: contentX + 0.08, y, w: contentW - 0.08 },
        scaledBulletPreset,
        17 * questionScale,
        { minLines: 1, paragraphGapLines: 0.28, margin: 0.01, bullet: { indent: 14 } }
      )
      if (isCorrectOption) {
        const textWidth = Math.min(
          contentW - 0.08,
          estimateInlineTextWidth(item, 17 * questionScale) + 0.26
        )
        pptxSlide.addShape('rect', {
          x: contentX + 0.04,
          y: y - 0.03,
          w: textWidth,
          h: height + 0.06,
          line: { color: 'C91F12', pt: 1.4 },
          fill: { color: 'FFFFFF', transparency: 100 }
        })
      }
      y += height + 0.08
    }
    y += 0.04
  }

  if (regions.tips.length > 0) {
    y += 0.06
    for (const element of regions.tips) {
      const tipText = element.type === 'list'
        ? element.items.join('\n')
        : element.type === 'text' || element.type === 'blockquote' || element.type === 'heading'
          ? element.content
          : ''
      if (!tipText.trim()) continue
      const height = addFittedText(
        pptxSlide,
        tipText,
        { x: contentX, y, w: contentW },
        {
          ...scaledBodyPreset,
          color: '6B6A68'
        },
        13 * questionScale,
        { minLines: 1, paragraphGapLines: 0.28, margin: 0.01 }
      )
      y += height + 0.06
    }
  }
}

function groupElementsByRegion(elements: SlideElement[]): Record<SlideRegion, SlideElement[]> {
  return {
    hero: elements.filter((element) => element.region === 'hero'),
    lead: elements.filter((element) => element.region === 'lead'),
    body: elements.filter((element) => element.region === 'body'),
    question: elements.filter((element) => element.region === 'question'),
    options: elements.filter((element) => element.region === 'options'),
    material: elements.filter((element) => element.region === 'material'),
    analysis: elements.filter((element) => element.region === 'analysis'),
    answer: elements.filter((element) => element.region === 'answer'),
    tips: elements.filter((element) => element.region === 'tips'),
    summary: elements.filter((element) => element.region === 'summary'),
    footer: elements.filter((element) => element.region === 'footer')
  }
}

function renderRegionCard(
  pptxSlide: PptxGenJS.Slide,
  elements: SlideElement[],
  box: { x: number; y: number; w: number; h: number },
  label: string,
  theme: PptxThemeConfig,
  slideClass: string | null,
  options?: { hideLabel?: boolean; listAsPlainText?: boolean; correctOptionLabel?: string | null }
): void {
  if (elements.length === 0) return

  pptxSlide.addShape('rect', {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rectRadius: 0.08,
    line: { color: 'D7C8BE', pt: 1 },
    fill: { color: 'FBF7F3' }
  })

  const labelPreset = resolvePreset(theme, slideClass, 'subtitle')
  const bodyPreset = resolvePreset(theme, slideClass, 'body')
  const bulletPreset = resolvePreset(theme, slideClass, 'bullet')
  const contentScale = resolveRegionContentScale(elements, box, theme)
  const scaledLabelPreset = scaleTextPreset(labelPreset, contentScale)
  const scaledBodyPreset = scaleTextPreset(bodyPreset, contentScale)
  const scaledBulletPreset = scaleTextPreset(bulletPreset, contentScale)
  const itemGap = contentScale < 0.92 ? 0.04 : 0.08
  const sectionGap = contentScale < 0.92 ? 0.02 : 0.03

  if (!options?.hideLabel) {
    pptxSlide.addText(label, {
      x: box.x + 0.22,
      y: box.y + 0.14,
      w: box.w - 0.44,
      h: 0.32,
      margin: 0,
      fit: 'shrink',
      valign: 'middle',
      color: 'AE5630',
      bold: true,
      fontFace: scaledLabelPreset.fontFace ?? scaledBodyPreset.fontFace,
      fontSize: typeof scaledLabelPreset.fontSize === 'number' ? scaledLabelPreset.fontSize : 16 * contentScale
    })
  }

  let y = box.y + (options?.hideLabel ? 0.18 : 0.56)
  const maxY = box.y + box.h - 0.18

  for (const element of elements) {
    if (y >= maxY) break

    switch (element.type) {
      case 'heading': {
        const height = addFittedText(
          pptxSlide,
          element.content,
          { x: box.x + 0.22, y, w: box.w - 0.44 },
          scaledLabelPreset,
          18 * contentScale,
          { minLines: 1, paragraphGapLines: 0.2 }
        )
        y += height + itemGap
        break
      }
      case 'text':
      case 'blockquote': {
        const height = addFittedText(
          pptxSlide,
          element.content,
          { x: box.x + 0.22, y, w: box.w - 0.44 },
          { ...scaledBodyPreset, italic: element.type === 'blockquote' || scaledBodyPreset.italic },
          16 * contentScale,
          { minLines: 1, paragraphGapLines: 0.35, margin: 0.01 }
        )
        y += height + itemGap
        break
      }
      case 'list': {
        for (const item of element.items) {
          if (y >= maxY) break
          const optionMatch = item.trim().match(/^([A-D])[.．、:\s]/i)
          const isCorrectOption = Boolean(
            options?.correctOptionLabel &&
            optionMatch?.[1]?.toUpperCase() === options.correctOptionLabel
          )
          const height = addFittedText(
            pptxSlide,
            item,
            { x: box.x + 0.26, y, w: box.w - 0.52 },
            options?.listAsPlainText ? scaledBodyPreset : scaledBulletPreset,
            15 * contentScale,
            options?.listAsPlainText
              ? {
                  minLines: 1,
                  paragraphGapLines: 0.28,
                  margin: 0.01
                }
              : {
                  minLines: 1,
                  paragraphGapLines: 0.25,
                  margin: 0.01,
                  bullet: { indent: 12 }
                }
          )
          if (isCorrectOption) {
            const textWidth = Math.min(
              box.w - 0.52,
              estimateInlineTextWidth(item, 15 * contentScale) + 0.26
            )
            pptxSlide.addShape('rect', {
              x: box.x + 0.22,
              y: y - 0.04,
              w: textWidth,
              h: height + 0.08,
              line: { color: 'C91F12', pt: 1.6 },
              fill: { color: 'FFFFFF', transparency: 100 }
            })
          }
          y += height + Math.max(0.03, itemGap - 0.01)
        }
        y += sectionGap
        break
      }
      case 'table': {
        const rows: string[][] = [element.headers, ...element.rows]
        const tableRows = rows.map((row) => row.map((cell) => ({ text: cell })))
        pptxSlide.addTable(tableRows as PptxGenJS.TableRow[], {
          x: box.x + 0.18,
          y,
          w: box.w - 0.36,
          fontSize: 11,
          border: { pt: 0.4, color: 'D5D1CB' },
          colW: Array(element.headers.length).fill((box.w - 0.36) / element.headers.length)
        })
        y += Math.min(1.6, 0.32 * (rows.length + 1))
        break
      }
      case 'image': {
        const imageHeight = Math.min(1.6, maxY - y)
        if (imageHeight <= 0.2) break
        pptxSlide.addImage({
          data: element.src,
          x: box.x + 0.2,
          y,
          w: box.w - 0.4,
          h: imageHeight,
          sizing: { type: 'contain', w: box.w - 0.4, h: imageHeight }
        })
        y += imageHeight + 0.08
        break
      }
    }
  }
}

function renderElement(
  pptxSlide: PptxGenJS.Slide,
  el: SlideElement,
  theme: PptxThemeConfig,
  slideClass: string | null,
  yPosition: number,
  contentScale = 1
): number {
  switch (el.type) {
    case 'heading': {
      const preset = scaleTextPreset(resolvePreset(theme, slideClass, 'subtitle'), contentScale)
      const height = addFittedText(
        pptxSlide,
        el.content,
        { x: 0.6, y: yPosition, w: 11.2 },
        preset,
        24 * contentScale,
        { minLines: 1, paragraphGapLines: 0.2 }
      )
      return yPosition + height + (contentScale < 0.92 ? 0.1 : 0.14)
    }

    case 'text': {
      const preset = scaleTextPreset(resolvePreset(theme, slideClass, 'body'), contentScale)
      const height = addFittedText(
        pptxSlide,
        el.content,
        { x: 0.6, y: yPosition, w: 11 },
        preset,
        18 * contentScale,
        { minLines: 1, paragraphGapLines: 0.5, margin: 0.02 }
      )
      return yPosition + height + (contentScale < 0.92 ? 0.09 : 0.12)
    }

    case 'list': {
      const preset = scaleTextPreset(resolvePreset(theme, slideClass, 'bullet'), contentScale)
      for (const item of el.items) {
        const height = addFittedText(
          pptxSlide,
          item,
          { x: 0.9, y: yPosition, w: 10.5 },
          preset,
          16 * contentScale,
          {
            minLines: 1,
            paragraphGapLines: 0.35,
            margin: 0.02,
            bullet: { indent: 14 }
          }
        )
        yPosition += height + (contentScale < 0.92 ? 0.05 : 0.08)
      }
      return yPosition + (contentScale < 0.92 ? 0.02 : 0.04)
    }

    case 'blockquote': {
      const preset = scaleTextPreset(resolvePreset(theme, slideClass, 'body'), contentScale)
      const height = addFittedText(
        pptxSlide,
        el.content,
        { x: 1.0, y: yPosition, w: 10.5 },
        { ...preset, italic: true },
        18 * contentScale,
        { minLines: 1, paragraphGapLines: 0.45, margin: 0.02 }
      )
      return yPosition + height + (contentScale < 0.92 ? 0.09 : 0.12)
    }

    case 'table': {
      const rows: string[][] = [el.headers, ...el.rows]
      const tableRows = rows.map((row) =>
        row.map((cell) => ({ text: cell }))
      )
      pptxSlide.addTable(tableRows as PptxGenJS.TableRow[], {
        x: 0.6,
        y: yPosition,
        w: 11.2,
        fontSize: Math.max(10, 14 * contentScale),
        border: { pt: 0.5, color: 'CCCCCC' },
        colW: Array(el.headers.length).fill(11.2 / el.headers.length)
      })
      return yPosition + 0.5 * (rows.length + 1)
    }

    case 'image': {
      pptxSlide.addImage({
        data: el.src,
        x: 1.5,
        y: yPosition,
        w: 9.4,
        h: 4.5,
        sizing: { type: 'contain', w: 9.4, h: 4.5 }
      })
      return yPosition + 4.7
    }

    default:
      return yPosition
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
