import PptxGenJS from 'pptxgenjs'
import { writeFile } from 'fs/promises'
import { newLessonPptxTheme, type PptxThemeConfig } from '../../themes/pptx/new-lesson'
import { mistakeReviewPptxTheme } from '../../themes/pptx/mistake-review'
import type { Slide, SlideElement, SlideRegion } from '../../shared/types/slide'
import type { PresentationTypographySettings } from '../../shared/types/settings'

const PPTX_THEME_MAP: Record<string, PptxThemeConfig> = {
  'new-lesson': newLessonPptxTheme,
  'mistake-review': mistakeReviewPptxTheme
}

const STRUCTURED_QUESTION_KINDS = new Set([
  'question-choice',
  'question-material',
  'question-answer'
])

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
  pptx.lang = 'zh-CN'

  const theme = applyTypographyToTheme(
    PPTX_THEME_MAP[themeName] || newLessonPptxTheme,
    typography
  )

  for (const slide of slides) {
    const pptxSlide = pptx.addSlide()
    const slideClass = slide.kind || (slide.layout !== 'content' ? slide.layout : null)
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
    bullet?: PptxGenJS.BulletProps
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

function renderSlideContent(
  pptxSlide: PptxGenJS.Slide,
  slide: Slide,
  theme: PptxThemeConfig,
  slideClass: string | null
): void {
  let yPosition = 0.6

  if (slide.title) {
    const preset = resolvePreset(theme, slideClass, 'title')
    const height = addFittedText(
      pptxSlide,
      slide.title,
      { x: 0.6, y: yPosition, w: 11.2 },
      preset,
      36,
      { minLines: 1, paragraphGapLines: 0.2 }
    )
    yPosition += height + 0.22
  }

  if (slide.subtitle) {
    const preset = resolvePreset(theme, slideClass, 'subtitle')
    const height = addFittedText(
      pptxSlide,
      slide.subtitle,
      { x: 0.6, y: yPosition, w: 11.2 },
      preset,
      24,
      { minLines: 1, paragraphGapLines: 0.25 }
    )
    yPosition += height + 0.16
  }

  if (
    slide.kind &&
    STRUCTURED_QUESTION_KINDS.has(slide.kind) &&
    slide.elements.some((element) => element.region)
  ) {
    renderStructuredQuestionSlide(pptxSlide, slide, theme, slideClass, yPosition)
    return
  }

  for (const el of slide.elements) {
    yPosition = renderElement(pptxSlide, el, theme, slideClass, yPosition)
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
    renderRegionCard(
      pptxSlide,
      regions.question,
      { x: 0.6, y: startY, w: 11.2, h: 1.25 },
      '题干',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.options,
      { x: 0.6, y: startY + 1.5, w: 6.8, h: 4.15 },
      '选项',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.answer,
      { x: 7.7, y: startY + 1.5, w: 4.1, h: 2.05 },
      '答案',
      theme,
      slideClass
    )
    renderRegionCard(
      pptxSlide,
      regions.tips,
      { x: 7.7, y: startY + 3.8, w: 4.1, h: 1.85 },
      '提醒',
      theme,
      slideClass
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
  slideClass: string | null
): void {
  if (elements.length === 0) return

  pptxSlide.addShape(PptxGenJS.ShapeType.rect, {
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

  pptxSlide.addText(label, {
    x: box.x + 0.22,
    y: box.y + 0.14,
    w: box.w - 0.44,
    h: 0.32,
    margin: 0,
    fit: 'shrink',
    valign: 'mid',
    color: 'AE5630',
    bold: true,
    fontFace: labelPreset.fontFace ?? bodyPreset.fontFace,
    fontSize: typeof labelPreset.fontSize === 'number' ? labelPreset.fontSize : 16
  })

  let y = box.y + 0.56
  const maxY = box.y + box.h - 0.18

  for (const element of elements) {
    if (y >= maxY) break

    switch (element.type) {
      case 'heading': {
        const height = addFittedText(
          pptxSlide,
          element.content,
          { x: box.x + 0.22, y, w: box.w - 0.44 },
          labelPreset,
          18,
          { minLines: 1, paragraphGapLines: 0.2 }
        )
        y += height + 0.08
        break
      }
      case 'text':
      case 'blockquote': {
        const height = addFittedText(
          pptxSlide,
          element.content,
          { x: box.x + 0.22, y, w: box.w - 0.44 },
          { ...bodyPreset, italic: element.type === 'blockquote' || bodyPreset.italic },
          16,
          { minLines: 1, paragraphGapLines: 0.35, margin: 0.01 }
        )
        y += height + 0.08
        break
      }
      case 'list': {
        for (const item of element.items) {
          if (y >= maxY) break
          const height = addFittedText(
            pptxSlide,
            item,
            { x: box.x + 0.26, y, w: box.w - 0.52 },
            bulletPreset,
            15,
            {
              minLines: 1,
              paragraphGapLines: 0.25,
              margin: 0.01,
              bullet: { indent: 12 }
            }
          )
          y += height + 0.05
        }
        y += 0.03
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
  yPosition: number
): number {
  switch (el.type) {
    case 'heading': {
      const preset = resolvePreset(theme, slideClass, 'subtitle')
      const height = addFittedText(
        pptxSlide,
        el.content,
        { x: 0.6, y: yPosition, w: 11.2 },
        preset,
        24,
        { minLines: 1, paragraphGapLines: 0.2 }
      )
      return yPosition + height + 0.14
    }

    case 'text': {
      const preset = resolvePreset(theme, slideClass, 'body')
      const height = addFittedText(
        pptxSlide,
        el.content,
        { x: 0.6, y: yPosition, w: 11 },
        preset,
        18,
        { minLines: 1, paragraphGapLines: 0.5, margin: 0.02 }
      )
      return yPosition + height + 0.12
    }

    case 'list': {
      const preset = resolvePreset(theme, slideClass, 'bullet')
      for (const item of el.items) {
        const height = addFittedText(
          pptxSlide,
          item,
          { x: 0.9, y: yPosition, w: 10.5 },
          preset,
          16,
          {
            minLines: 1,
            paragraphGapLines: 0.35,
            margin: 0.02,
            bullet: { indent: 14 }
          }
        )
        yPosition += height + 0.08
      }
      return yPosition + 0.04
    }

    case 'blockquote': {
      const preset = resolvePreset(theme, slideClass, 'body')
      const height = addFittedText(
        pptxSlide,
        el.content,
        { x: 1.0, y: yPosition, w: 10.5 },
        { ...preset, italic: true },
        18,
        { minLines: 1, paragraphGapLines: 0.45, margin: 0.02 }
      )
      return yPosition + height + 0.12
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
        fontSize: 14,
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
