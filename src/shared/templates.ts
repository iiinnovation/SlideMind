import type { SlideKind, SlideLayout, SlideRegion } from './types/slide'

export type SlideScene = 'new-lesson' | 'mistake-review' | 'exam-review'

export interface SlideTemplateSpec {
  id: string
  scene: SlideScene
  label: string
  layout: SlideLayout
  kind: SlideKind
  density: 'light' | 'medium' | 'dense'
  regions: SlideRegion[]
  useCase: string
  previewClass: string
  pptxClass: string
  maxElements: number
  preferredElementTypes: Array<'heading' | 'text' | 'list' | 'blockquote' | 'table' | 'image'>
  fallbackSplitStrategy: 'list-first' | 'region-first' | 'balanced'
}

export const SLIDE_TEMPLATE_LIBRARY: Record<SlideScene, SlideTemplateSpec[]> = {
  'new-lesson': [
    {
      id: 'cover-hero',
      scene: 'new-lesson',
      label: '课程封面',
      layout: 'title',
      kind: 'cover',
      density: 'light',
      regions: ['hero', 'lead'],
      useCase: '课程标题、主题导入',
      previewClass: 'tpl-cover-hero',
      pptxClass: 'tpl-cover-hero',
      maxElements: 2,
      preferredElementTypes: ['list', 'text'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'section-break',
      scene: 'new-lesson',
      label: '章节过渡页',
      layout: 'content',
      kind: 'section',
      density: 'light',
      regions: ['lead', 'body'],
      useCase: '承上启下、切换新主题',
      previewClass: 'tpl-section-break',
      pptxClass: 'tpl-section-break',
      maxElements: 3,
      preferredElementTypes: ['heading', 'text', 'list'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'knowledge-bullets',
      scene: 'new-lesson',
      label: '知识点要点页',
      layout: 'content',
      kind: 'knowledge-points',
      density: 'medium',
      regions: ['body'],
      useCase: '分点讲解核心概念',
      previewClass: 'tpl-knowledge-bullets',
      pptxClass: 'tpl-knowledge-bullets',
      maxElements: 5,
      preferredElementTypes: ['list', 'heading'],
      fallbackSplitStrategy: 'list-first'
    },
    {
      id: 'knowledge-compare',
      scene: 'new-lesson',
      label: '知识对比页',
      layout: 'content',
      kind: 'knowledge-points',
      density: 'medium',
      regions: ['body'],
      useCase: '概念辨析、相似点对比',
      previewClass: 'tpl-knowledge-compare',
      pptxClass: 'tpl-knowledge-compare',
      maxElements: 6,
      preferredElementTypes: ['heading', 'list'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'example-explanation',
      scene: 'new-lesson',
      label: '例题讲解页',
      layout: 'content',
      kind: 'explanation',
      density: 'medium',
      regions: ['body'],
      useCase: '例题拆解、思路讲解',
      previewClass: 'tpl-example-explanation',
      pptxClass: 'tpl-example-explanation',
      maxElements: 6,
      preferredElementTypes: ['heading', 'list', 'text'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'method-summary',
      scene: 'new-lesson',
      label: '方法归纳页',
      layout: 'content',
      kind: 'explanation',
      density: 'medium',
      regions: ['body'],
      useCase: '步骤总结、方法框架',
      previewClass: 'tpl-method-summary',
      pptxClass: 'tpl-method-summary',
      maxElements: 5,
      preferredElementTypes: ['heading', 'list'],
      fallbackSplitStrategy: 'list-first'
    },
    {
      id: 'experiment-steps',
      scene: 'new-lesson',
      label: '实验步骤页',
      layout: 'content',
      kind: 'explanation',
      density: 'dense',
      regions: ['body'],
      useCase: '实验课步骤与现象',
      previewClass: 'tpl-experiment-steps',
      pptxClass: 'tpl-experiment-steps',
      maxElements: 7,
      preferredElementTypes: ['heading', 'list', 'table'],
      fallbackSplitStrategy: 'list-first'
    },
    {
      id: 'summary-close',
      scene: 'new-lesson',
      label: '课堂总结页',
      layout: 'summary',
      kind: 'summary',
      density: 'light',
      regions: ['summary'],
      useCase: '回顾要点、布置思考',
      previewClass: 'tpl-summary-close',
      pptxClass: 'tpl-summary-close',
      maxElements: 4,
      preferredElementTypes: ['list'],
      fallbackSplitStrategy: 'list-first'
    }
  ],
  'exam-review': [
    {
      id: 'exam-cover',
      scene: 'exam-review',
      label: '试卷总览页',
      layout: 'title',
      kind: 'cover',
      density: 'light',
      regions: ['lead'],
      useCase: '概览试卷结构、题量和讲评重点',
      previewClass: 'tpl-exam-cover',
      pptxClass: 'tpl-exam-cover',
      maxElements: 3,
      preferredElementTypes: ['list', 'text'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'choice-batch-review',
      scene: 'exam-review',
      label: '选择题批量讲评页',
      layout: 'content',
      kind: 'question-choice',
      density: 'medium',
      regions: ['question', 'options', 'tips'],
      useCase: '每页承载一组选择题，突出题干和选项信息',
      previewClass: 'tpl-choice-batch-review',
      pptxClass: 'tpl-choice-batch-review',
      maxElements: 8,
      preferredElementTypes: ['heading', 'list', 'text'],
      fallbackSplitStrategy: 'region-first'
    },
    {
      id: 'material-question-review',
      scene: 'exam-review',
      label: '材料设问讲评页',
      layout: 'content',
      kind: 'question-material',
      density: 'dense',
      regions: ['material', 'question', 'answer', 'tips'],
      useCase: '一段材料配对应设问与答案讲解',
      previewClass: 'tpl-material-question-review',
      pptxClass: 'tpl-material-question-review',
      maxElements: 8,
      preferredElementTypes: ['heading', 'text', 'list'],
      fallbackSplitStrategy: 'region-first'
    },
    {
      id: 'answer-reveal-review',
      scene: 'exam-review',
      label: '答案强调页',
      layout: 'content',
      kind: 'question-answer',
      density: 'medium',
      regions: ['question', 'answer', 'tips'],
      useCase: '强调标准答案、标出得分点或步骤',
      previewClass: 'tpl-answer-reveal-review',
      pptxClass: 'tpl-answer-reveal-review',
      maxElements: 7,
      preferredElementTypes: ['heading', 'list', 'text'],
      fallbackSplitStrategy: 'region-first'
    },
    {
      id: 'exam-summary',
      scene: 'exam-review',
      label: '试卷总结页',
      layout: 'summary',
      kind: 'summary',
      density: 'light',
      regions: ['summary'],
      useCase: '总结高频失分点和答题策略',
      previewClass: 'tpl-exam-summary',
      pptxClass: 'tpl-exam-summary',
      maxElements: 4,
      preferredElementTypes: ['list'],
      fallbackSplitStrategy: 'list-first'
    }
  ],
  'mistake-review': [
    {
      id: 'mistake-cover',
      scene: 'mistake-review',
      label: '错题总览页',
      layout: 'title',
      kind: 'cover',
      density: 'light',
      regions: ['lead'],
      useCase: '概览本次错题和易错点',
      previewClass: 'tpl-mistake-cover',
      pptxClass: 'tpl-mistake-cover',
      maxElements: 3,
      preferredElementTypes: ['list', 'text'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'choice-diagnosis',
      scene: 'mistake-review',
      label: '选择题讲评页',
      layout: 'content',
      kind: 'question-choice',
      density: 'medium',
      regions: ['question', 'options', 'tips'],
      useCase: '选择题题干、选项与作答提醒',
      previewClass: 'tpl-choice-diagnosis',
      pptxClass: 'tpl-choice-diagnosis',
      maxElements: 7,
      preferredElementTypes: ['list', 'heading'],
      fallbackSplitStrategy: 'region-first'
    },
    {
      id: 'material-diagnosis',
      scene: 'mistake-review',
      label: '材料题讲评页',
      layout: 'content',
      kind: 'question-material',
      density: 'dense',
      regions: ['material', 'question', 'analysis', 'answer', 'tips'],
      useCase: '材料背景较长，需要分区展示',
      previewClass: 'tpl-material-diagnosis',
      pptxClass: 'tpl-material-diagnosis',
      maxElements: 8,
      preferredElementTypes: ['list', 'heading', 'text'],
      fallbackSplitStrategy: 'region-first'
    },
    {
      id: 'answer-diagnosis',
      scene: 'mistake-review',
      label: '解法拆解页',
      layout: 'content',
      kind: 'question-answer',
      density: 'medium',
      regions: ['question', 'analysis', 'answer', 'tips'],
      useCase: '单题错因、步骤、提醒',
      previewClass: 'tpl-answer-diagnosis',
      pptxClass: 'tpl-answer-diagnosis',
      maxElements: 7,
      preferredElementTypes: ['list', 'heading'],
      fallbackSplitStrategy: 'region-first'
    },
    {
      id: 'mistake-patterns',
      scene: 'mistake-review',
      label: '错因归类页',
      layout: 'content',
      kind: 'explanation',
      density: 'medium',
      regions: ['analysis', 'tips', 'body'],
      useCase: '多题共性错因整理',
      previewClass: 'tpl-mistake-patterns',
      pptxClass: 'tpl-mistake-patterns',
      maxElements: 6,
      preferredElementTypes: ['heading', 'list', 'blockquote'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'qa-review',
      scene: 'mistake-review',
      label: '问答复盘页',
      layout: 'content',
      kind: 'explanation',
      density: 'medium',
      regions: ['question', 'answer', 'tips'],
      useCase: '师生问答式复盘',
      previewClass: 'tpl-qa-review',
      pptxClass: 'tpl-qa-review',
      maxElements: 6,
      preferredElementTypes: ['heading', 'list', 'text'],
      fallbackSplitStrategy: 'balanced'
    },
    {
      id: 'mistake-summary',
      scene: 'mistake-review',
      label: '方法归纳页',
      layout: 'summary',
      kind: 'summary',
      density: 'light',
      regions: ['summary'],
      useCase: '提炼共性错误与口诀',
      previewClass: 'tpl-mistake-summary',
      pptxClass: 'tpl-mistake-summary',
      maxElements: 4,
      preferredElementTypes: ['list'],
      fallbackSplitStrategy: 'list-first'
    }
  ]
}

export const SLIDE_TEMPLATE_MAP = Object.fromEntries(
  Object.values(SLIDE_TEMPLATE_LIBRARY)
    .flat()
    .map((template) => [template.id, template])
) as Record<string, SlideTemplateSpec>

export function getSceneTemplates(scene: SlideScene): SlideTemplateSpec[] {
  return SLIDE_TEMPLATE_LIBRARY[scene]
}

export function getSlideTemplate(templateId?: string | null): SlideTemplateSpec | null {
  if (!templateId) return null
  return SLIDE_TEMPLATE_MAP[templateId] ?? null
}
