import PptxGenJS from 'pptxgenjs'
import { writeFile } from 'fs/promises'
import { newLessonPptxTheme, type PptxThemeConfig } from '../../themes/pptx/new-lesson'
import { mistakeReviewPptxTheme } from '../../themes/pptx/mistake-review'
import type { Slide, SlideElement } from '../../shared/types/slide'

const PPTX_THEME_MAP: Record<string, PptxThemeConfig> = {
  'new-lesson': newLessonPptxTheme,
  'mistake-review': mistakeReviewPptxTheme
}

export async function exportToPptx(
  slides: Slide[],
  themeName: string,
  outputPath: string
): Promise<void> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'SlideMind'
  pptx.company = 'SlideMind'
  pptx.subject = 'AI-generated teaching slides'
  pptx.title = 'SlideMind Export'
  pptx.lang = 'zh-CN'

  const theme = PPTX_THEME_MAP[themeName] || newLessonPptxTheme

  for (const slide of slides) {
    const pptxSlide = pptx.addSlide()
    const slideClass = slide.layout !== 'content' ? slide.layout : null
    applySlideTheme(pptxSlide, theme, slideClass)
    renderSlideContent(pptxSlide, slide, theme, slideClass)
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  await writeFile(outputPath, buffer)
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

function renderSlideContent(
  pptxSlide: PptxGenJS.Slide,
  slide: Slide,
  theme: PptxThemeConfig,
  slideClass: string | null
): void {
  let yPosition = 0.6

  if (slide.title) {
    const preset = resolvePreset(theme, slideClass, 'title')
    pptxSlide.addText(stripInlineFormatting(slide.title), {
      x: 0.6,
      y: yPosition,
      w: 11.2,
      h: 0.6,
      fit: 'shrink',
      valign: 'mid',
      ...preset
    })
    yPosition += 0.9
  }

  if (slide.subtitle) {
    const preset = resolvePreset(theme, slideClass, 'subtitle')
    pptxSlide.addText(stripInlineFormatting(slide.subtitle), {
      x: 0.6,
      y: yPosition,
      w: 11.2,
      h: 0.6,
      fit: 'shrink',
      valign: 'mid',
      ...preset
    })
    yPosition += 0.7
  }

  for (const el of slide.elements) {
    yPosition = renderElement(pptxSlide, el, theme, slideClass, yPosition)
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
      pptxSlide.addText(stripInlineFormatting(el.content), {
        x: 0.6,
        y: yPosition,
        w: 11.2,
        h: 0.6,
        fit: 'shrink',
        valign: 'mid',
        ...preset
      })
      return yPosition + 0.7
    }

    case 'text': {
      const preset = resolvePreset(theme, slideClass, 'body')
      pptxSlide.addText(stripInlineFormatting(el.content), {
        x: 0.6,
        y: yPosition,
        w: 11,
        h: 0.5,
        fit: 'shrink',
        valign: 'mid',
        breakLine: false,
        ...preset
      })
      return yPosition + 0.55
    }

    case 'list': {
      const preset = resolvePreset(theme, slideClass, 'bullet')
      for (const item of el.items) {
        pptxSlide.addText(stripInlineFormatting(item), {
          x: 0.9,
          y: yPosition,
          w: 10.5,
          h: 0.45,
          fit: 'shrink',
          valign: 'mid',
          breakLine: false,
          ...preset
        })
        yPosition += 0.45
      }
      return yPosition
    }

    case 'blockquote': {
      const preset = resolvePreset(theme, slideClass, 'body')
      pptxSlide.addText(stripInlineFormatting(el.content), {
        x: 1.0,
        y: yPosition,
        w: 10.5,
        h: 0.5,
        fit: 'shrink',
        valign: 'mid',
        italic: true,
        ...preset
      })
      return yPosition + 0.55
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
