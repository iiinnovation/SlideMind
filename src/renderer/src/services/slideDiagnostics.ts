import { EXPORT_LAYOUT_LIMITS } from '../../../shared/constants'
import { getSceneTemplates, getSlideTemplate } from '../../../shared/templates'
import type { Slide, SlideElement, SlideKind, SlideRegion } from '../../../shared/types/slide'
import type { SlideScene, SlideTemplateSpec } from '../../../shared/templates'

export type SlideDiagnosticLevel = 'warning' | 'error'

export interface SlideDiagnostic {
  level: SlideDiagnosticLevel
  code:
    | 'empty-slide'
    | 'title-too-long'
    | 'subtitle-too-long'
    | 'too-many-elements'
    | 'list-too-long'
    | 'paragraph-too-long'
    | 'missing-region'
    | 'template-mismatch'
  message: string
}

export interface SlideDiagnosticReportItem {
  slideIndex: number
  title: string
  diagnostics: SlideDiagnostic[]
}

const DEFAULT_MAX_TITLE_LENGTH = 28
const DEFAULT_MAX_SUBTITLE_LENGTH = 44
const DEFAULT_MAX_PARAGRAPH_LENGTH = 140
const DEFAULT_MAX_LIST_ITEMS = 6
const DEFAULT_MAX_LIST_ITEM_LENGTH = 36

const STRUCTURED_KINDS: SlideKind[] = ['question-answer', 'question-choice', 'question-material']

export function getSlideDiagnostics(slide: Slide): SlideDiagnostic[] {
  const diagnostics: SlideDiagnostic[] = []
  const template = getSlideTemplate(slide.templateId)

  if (!slide.elements.length) {
    diagnostics.push({
      level: 'error',
      code: 'empty-slide',
      message: '当前页没有内容元素，导出时会出现空白页。'
    })
  }

  if ((slide.title ?? '').trim().length > DEFAULT_MAX_TITLE_LENGTH) {
    diagnostics.push({
      level: 'warning',
      code: 'title-too-long',
      message: '标题偏长，建议压缩或拆页。'
    })
  }

  if ((slide.subtitle ?? '').trim().length > DEFAULT_MAX_SUBTITLE_LENGTH) {
    diagnostics.push({
      level: 'warning',
      code: 'subtitle-too-long',
      message: '副标题偏长，预览和导出都可能拥挤。'
    })
  }

  const maxElements = template?.maxElements ?? getKindMaxElements(slide.kind)
  if (slide.elements.length > maxElements) {
    diagnostics.push({
      level: 'warning',
      code: 'too-many-elements',
      message: `当前页元素偏多，建议拆页或改用更紧凑的模板。`
    })
  }

  for (const element of slide.elements) {
    const contentDiagnostic = getElementDiagnostic(element, slide.kind)
    if (contentDiagnostic) {
      diagnostics.push(contentDiagnostic)
    }
  }

  if (slide.kind && STRUCTURED_KINDS.includes(slide.kind)) {
    const missingRegions = getMissingStructuredRegions(slide)
    for (const region of missingRegions) {
      diagnostics.push({
        level: 'error',
        code: 'missing-region',
        message: `缺少“${formatRegion(region)}”区域，建议补标准结构。`
      })
    }
  }

  if (template) {
    if (template.kind !== slide.kind || template.layout !== slide.layout) {
      diagnostics.push({
        level: 'warning',
        code: 'template-mismatch',
        message: '当前模板与页面 kind/layout 不一致，建议重新套用模板。'
      })
    }
  }

  return dedupeDiagnostics(diagnostics)
}

export function getSlideDiagnosticSummary(slide: Slide): {
  count: number
  highestLevel: SlideDiagnosticLevel | null
} {
  const diagnostics = getSlideDiagnostics(slide)
  if (!diagnostics.length) {
    return { count: 0, highestLevel: null }
  }

  return {
    count: diagnostics.length,
    highestLevel: diagnostics.some((item) => item.level === 'error') ? 'error' : 'warning'
  }
}

export function getRecommendedTemplates(scene: SlideScene, slide: Slide): SlideTemplateSpec[] {
  const templates = getSceneTemplates(scene)
  return templates
    .filter((template) => template.kind === slide.kind || template.layout === slide.layout)
    .sort((left, right) => scoreTemplate(right, slide) - scoreTemplate(left, slide))
    .slice(0, 3)
}

export function getDeckDiagnosticReport(slides: Slide[]): {
  items: SlideDiagnosticReportItem[]
  warningCount: number
  errorCount: number
} {
  const items = slides
    .map((slide, slideIndex) => ({
      slideIndex,
      title: slide.title?.trim() || slide.kind || slide.layout || `页面 ${slideIndex + 1}`,
      diagnostics: getSlideDiagnostics(slide)
    }))
    .filter((item) => item.diagnostics.length > 0)

  let warningCount = 0
  let errorCount = 0
  for (const item of items) {
    for (const diagnostic of item.diagnostics) {
      if (diagnostic.level === 'error') {
        errorCount += 1
      } else {
        warningCount += 1
      }
    }
  }

  return {
    items,
    warningCount,
    errorCount
  }
}

function getElementDiagnostic(element: SlideElement, kind?: SlideKind): SlideDiagnostic | null {
  switch (element.type) {
    case 'text':
    case 'blockquote':
    case 'heading':
      if (element.content.trim().length > DEFAULT_MAX_PARAGRAPH_LENGTH) {
        return {
          level: 'warning',
          code: 'paragraph-too-long',
          message: '存在较长文本块，建议拆成列表或分到下一页。'
        }
      }
      return null
    case 'list': {
      const maxItems = getListItemLimit(kind)
      if (
        element.items.length > maxItems ||
        element.items.some((item) => item.trim().length > DEFAULT_MAX_LIST_ITEM_LENGTH)
      ) {
        return {
          level: 'warning',
          code: 'list-too-long',
          message: '列表项偏多或单项偏长，导出时容易拥挤。'
        }
      }
      return null
    }
    case 'table':
    case 'image':
      return null
  }
}

function getMissingStructuredRegions(slide: Slide): SlideRegion[] {
  if (!slide.kind || !STRUCTURED_KINDS.includes(slide.kind)) return []
  const requiredRegions = EXPORT_LAYOUT_LIMITS.structuredRegionPriority[slide.kind]
  const presentRegions = new Set(slide.elements.map((element) => element.region).filter(Boolean))
  return requiredRegions.filter((region) => !presentRegions.has(region))
}

function getKindMaxElements(kind?: SlideKind): number {
  switch (kind) {
    case 'summary':
      return 4
    case 'question-answer':
    case 'question-choice':
      return 7
    case 'question-material':
      return 8
    default:
      return 6
  }
}

function getListItemLimit(kind?: SlideKind): number {
  if (kind === 'summary') {
    return EXPORT_LAYOUT_LIMITS.genericMaxListItems.summary
  }
  if (kind === 'knowledge-points') {
    return EXPORT_LAYOUT_LIMITS.genericMaxListItems['knowledge-points']
  }
  return DEFAULT_MAX_LIST_ITEMS
}

function formatRegion(region: SlideRegion): string {
  switch (region) {
    case 'hero':
      return '导语'
    case 'lead':
      return '概览'
    case 'body':
      return '正文'
    case 'question':
      return '题干'
    case 'options':
      return '选项'
    case 'material':
      return '材料'
    case 'analysis':
      return '解析'
    case 'answer':
      return '答案'
    case 'tips':
      return '提醒'
    case 'summary':
      return '总结'
    case 'footer':
      return '备注'
  }
}

function dedupeDiagnostics(diagnostics: SlideDiagnostic[]): SlideDiagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((item) => {
    const key = `${item.level}:${item.code}:${item.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function scoreTemplate(template: SlideTemplateSpec, slide: Slide): number {
  let score = 0

  if (template.kind === slide.kind) score += 4
  if (template.layout === slide.layout) score += 2
  if (template.regions.some((region) => slide.elements.some((element) => element.region === region))) {
    score += 2
  }
  if (slide.elements.length <= template.maxElements) {
    score += 1
  }

  return score
}
