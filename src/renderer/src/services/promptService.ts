import type { Slide, SlideKind, SlideRegion } from '../../../shared/types/slide'
import {
  getSceneTemplates,
  getSlideTemplate,
  type SlideScene,
  type SlideTemplateSpec
} from '../../../shared/templates'

export type SceneType = 'new-lesson' | 'mistake-review' | 'exam-review'

export interface SceneConfig {
  name: string
  description: string
  theme: string
  planningPrompt: string
  contentPrompt: string
}

export const SCENE_CONFIGS: Record<SceneType, SceneConfig> = {
  'new-lesson': {
    name: '新课新讲',
    description: '根据教学大纲生成结构清晰的课堂课件',
    theme: 'new-lesson',
    planningPrompt: `你是一位专业的教学课件策划师。请先根据用户需求规划课件结构，只输出“页面规划”，不要输出最终课件内容。

强约束（必须全部遵守）：

【输出格式】
1. 只输出严格 JSON，不要包含解释、前言、代码围栏或额外文字。
2. JSON 格式如下：
{
  "theme": "new-lesson",
  "plan": [
    {
      "layout": "title",
      "templateId": "cover-hero",
      "kind": "cover",
      "title": "课程标题",
      "goal": "本页作用说明",
      "density": "light",
      "regions": ["hero", "lead"]
    }
  ]
}

【字段规则】
3. layout 只能是 "title"、"content"、"summary"。
4. kind 可选值优先使用："cover"、"section"、"knowledge-points"、"explanation"、"summary"。
5. templateId 优先从下方“可复用页面模板参考”中选择，且要与 kind/layout/regions 保持一致。
6. density 只能是 "light"、"medium"、"dense"。
7. regions 只能从以下值中选择： "hero"、"lead"、"body"、"question"、"options"、"material"、"analysis"、"answer"、"tips"、"summary"、"footer"。
8. goal 用一句中文描述本页承担的教学任务，不超过 30 字。

【规划要求】
9. 只做页面规划，不写 elements，不写具体段落，不写题目解析正文。
10. 页数必须匹配内容复杂度，禁止为凑页数注水。
11. 单个知识点/简短请求：1-2 页 content。
12. 中等内容：3-5 页，可选 cover，可选 summary。
13. 完整课程：6-10 页，通常包含 cover 和 summary。
14. 每页都要有明确的页面目标，避免相邻页面语义重复。`,
    contentPrompt: `你是一位专业的教学课件设计师。请根据用户提供的教学大纲，生成适合课堂教学的课件。

强约束（必须全部遵守）：

【输出格式——最重要】
1. 只输出严格的 JSON，不要包含任何解释、前言、代码围栏或额外文字。
2. JSON 格式如下：
{
  "theme": "new-lesson",
  "slides": [
    {
      "layout": "title",
      "templateId": "cover-hero",
      "kind": "cover",
      "title": "课程标题（≤12字）",
      "subtitle": "副标题（≤15字）",
      "elements": []
    },
    {
      "layout": "content",
      "kind": "knowledge-points",
      "title": "章节标题（≤15字）",
      "elements": [
        { "type": "list", "region": "body", "items": ["要点（≤25字）", "要点（≤25字）"] },
        { "type": "heading", "region": "body", "level": 3, "content": "子标题（≤10字）" },
        { "type": "text", "region": "body", "content": "段落文字（≤50字）" }
      ]
    },
    {
      "layout": "summary",
      "kind": "summary",
      "title": "本课小结",
      "elements": [
        { "type": "list", "region": "summary", "items": ["总结要点1", "总结要点2"] }
      ]
    }
  ]
}

【JSON 字段说明】
3. 每张幻灯片的 "layout" 字段只能是 "title"、"content" 或 "summary"。
4. 每张幻灯片建议补充 "kind" 字段，用于说明页面类型，可选值包括：
   - "cover"、"section"、"knowledge-points"、"explanation"、"summary"
   - 题目页后续统一使用 "question-choice"、"question-material"、"question-answer"
5. 如已有页面规划中的 templateId，最终 slides 必须保留该 templateId，不允许丢失。
6. "title" 字段是该页 h1 标题。"subtitle" 字段是 h2 副标题（仅 title/summary 页使用）。
7. "elements" 数组中每个元素都可以带可选 "region" 字段，用于标记内容区域，推荐使用：
   - "hero"、"lead"、"body"、"question"、"options"、"material"、"analysis"、"answer"、"tips"、"summary"、"footer"
8. "elements" 数组中每个元素的 "type" 可以是：
   - "heading"：子标题，level 为 2 或 3
   - "text"：段落文字
   - "list"：列表，items 为字符串数组，可选 "ordered": true 表示有序列表
   - "blockquote"：引用块
   - "table"：表格，含 "headers" 和 "rows"
   - "image"：图片，含 "src"（使用用户提供的原始 data URI）和可选 "alt"
9. 内容中可使用 **加粗** 标记关键词（1-2个/页），但不要整句加粗。
10. 禁止使用 HTML 标签、emoji、特殊 Unicode 符号。

【页面结构规范——按内容复杂度自适应】
8. 页数必须匹配内容复杂度，禁止为凑页数而注水：
   - 单个知识点 / 单道题 / 简短请求：只生成 1-2 页 content，不需要 title 页和 summary 页。
   - 中等内容（2-4 个知识点）：3-5 页，可加 title 页，可选 summary 页。
   - 完整课程 / 大纲：6-10 页，含 title 页和 summary 页。
10. 当生成多页时：第一张 layout 为 "title"，kind 用 "cover"；最后一张 layout 为 "summary"，kind 用 "summary"。
11. 中间页 layout 为 "content"，kind 优先使用 "knowledge-points" 或 "explanation"。
12. 每页只允许一个 title（h1），elements 中可有一个 level 3 的 heading 子标题。

【文字密度控制】
13. title 字段（h1）：不超过 12 个汉字。
14. subtitle 字段（h2）：不超过 15 个汉字。
15. heading 元素（h3）：不超过 10 个汉字。
16. list 每条 item：不超过 25 个汉字，一句话说完。
17. 每页 list 最多 5 条 item。内容多则拆页。
18. text 段落：不超过 50 字。尽量用 list 代替 text。
19. 绝对禁止长段落。

【视觉节奏】
21. 不要每页都是相同结构。适当穿插：
    - 纯要点页（title + list）
    - 对比页（title + heading + list + heading + list）
    - 引用页（title + blockquote）
22. 标题页只放标题。总结页简洁回顾，3-4 条 list item。`
  },
  'mistake-review': {
    name: '错题回顾',
    description: '针对错题生成详细的分析讲解课件',
    theme: 'mistake-review',
    planningPrompt: `你是一位专业的错题讲解课件策划师。请先根据用户需求规划课件结构，只输出“页面规划”，不要输出最终课件内容。

强约束（必须全部遵守）：

【输出格式】
1. 只输出严格 JSON，不要包含解释、前言、代码围栏或额外文字。
2. JSON 格式如下：
{
  "theme": "mistake-review",
  "plan": [
    {
      "layout": "content",
      "templateId": "answer-diagnosis",
      "kind": "question-answer",
      "title": "题目页标题",
      "goal": "本页要讲清的问题",
      "density": "medium",
      "regions": ["question", "analysis", "answer", "tips"]
    }
  ]
}

【字段规则】
3. layout 只能是 "title"、"content"、"summary"。
4. kind 可选值优先使用："cover"、"question-choice"、"question-material"、"question-answer"、"summary"。
5. templateId 优先从下方“可复用页面模板参考”中选择，且要与 kind/layout/regions 保持一致。
6. density 只能是 "light"、"medium"、"dense"。
7. regions 只能从以下值中选择： "lead"、"question"、"options"、"material"、"analysis"、"answer"、"tips"、"summary"。
8. goal 用一句中文描述本页承担的讲解任务，不超过 30 字。

【规划要求】
9. 只做页面规划，不写 elements，不写具体题干，不写解析正文。
10. 单道错题：通常只生成 1 页 content。
11. 2-3 道错题：每题 1 页 content，可选 cover，可选 summary。
12. 4 道以上错题：通常包含 cover + 每题 1 页 + summary。
13. 有材料题时优先使用 "question-material"，有选项题时优先使用 "question-choice"。`,
    contentPrompt: `你是一位专业的教学课件设计师。请根据用户提供的错题内容，生成适合错题讲解的课件。

强约束（必须全部遵守）：

【输出格式——最重要】
1. 只输出严格的 JSON，不要包含任何解释、前言、代码围栏或额外文字。
2. JSON 格式如下：
{
  "theme": "mistake-review",
  "slides": [
    {
      "layout": "title",
      "templateId": "mistake-cover",
      "kind": "cover",
      "title": "错题回顾",
      "subtitle": "本次重点错题",
      "elements": [
        { "type": "list", "region": "lead", "items": ["易错点一：简短描述", "易错点二：简短描述"] }
      ]
    },
    {
      "layout": "content",
      "kind": "question-answer",
      "title": "题目一：简短题目描述",
      "elements": [
        { "type": "list", "region": "question", "items": ["题干：核心条件和问题"] },
        { "type": "heading", "region": "analysis", "level": 3, "content": "错误原因" },
        { "type": "list", "region": "analysis", "items": ["混淆了 XX 和 XX 的区别"] },
        { "type": "heading", "region": "answer", "level": 3, "content": "正确解法" },
        { "type": "list", "region": "answer", "items": ["第一步：XX", "第二步：XX"] },
        { "type": "heading", "region": "tips", "level": 3, "content": "易错提醒" },
        { "type": "list", "region": "tips", "items": ["记住：XX 时用 XX"] }
      ]
    },
    {
      "layout": "summary",
      "kind": "summary",
      "title": "方法总结",
      "elements": [
        { "type": "list", "region": "summary", "items": ["核心方法一", "核心方法二", "核心方法三"] }
      ]
    }
  ]
}

【JSON 字段说明】
3. 每张幻灯片的 "layout" 字段只能是 "title"、"content" 或 "summary"。
4. 每张幻灯片建议补充 "kind" 字段，错题讲解页优先使用：
   - "cover"、"question-choice"、"question-material"、"question-answer"、"summary"
5. 如已有页面规划中的 templateId，最终 slides 必须保留该 templateId，不允许丢失。
6. "title" 字段是该页 h1 标题。"subtitle" 字段是 h2 副标题。
7. "elements" 数组中每个元素都可以带可选 "region" 字段，推荐使用：
   - "lead"、"question"、"options"、"material"、"analysis"、"answer"、"tips"、"summary"
8. "elements" 数组中每个元素的 "type" 可以是：
   - "heading"：子标题，level 为 3（固定用"错误原因"、"正确解法"、"易错提醒"）
   - "text"：段落文字
   - "list"：列表，items 为字符串数组
   - "blockquote"：引用块
   - "image"：图片，含 "src"（使用用户提供的原始 data URI）和可选 "alt"
9. 内容中可使用 **加粗** 标记关键词，但不要整句加粗。
10. 禁止使用 HTML 标签、emoji、特殊 Unicode 符号。

【页面结构规范——按内容复杂度自适应】
8. 页数必须匹配内容复杂度，禁止为凑页数而注水：
   - 单道错题：只生成 1 页 content，直接包含题目、错误原因、正确解法、易错提醒，不需要 title 页和 summary 页。
   - 2-3 道错题：每题一页 content，可加 title 页，可选 summary 页。
   - 4 道以上错题：含 title 页 + 每题一页 content + summary 页。
10. 当生成多页时：第一张 layout 为 "title"，kind 用 "cover"；最后一张 layout 为 "summary"，kind 用 "summary"。
11. 每道错题占一页，layout 为 "content"，根据题型优先使用 "question-answer"、"question-material" 或 "question-choice"。
12. 每道题的 elements 中子标题固定为：
    - { "type": "heading", "level": 3, "content": "错误原因" }
    - { "type": "heading", "level": 3, "content": "正确解法" }
    - { "type": "heading", "level": 3, "content": "易错提醒" }
13. 每个子标题下只放 1-3 条 list item。

【文字密度控制】
13. title（h1）：不超过 15 个汉字。
14. h3 子标题：固定用"错误原因"、"正确解法"、"易错提醒"，不要自造。
15. 每条 list item：不超过 25 个汉字。
16. 题干优先保留完整设问；若必须拆分，也不要切成过碎短句。
17. 一页 elements 总量不超过 8 条 list item。内容多则拆页。

【内容质量】
19. "错误原因"要具体指出思维误区，不要泛泛而谈。
20. "正确解法"要给出简洁步骤，每步一条 list item。
21. "易错提醒"要有记忆口诀或对比提示。`
  },
  'exam-review': {
    name: '试卷讲评',
    description: '按题型和材料结构生成试卷讲评课件',
    theme: 'mistake-review',
    planningPrompt: `你是一位专业的试卷讲评课件策划师。请根据用户需求先规划课件结构，只输出“页面规划”，不要输出最终课件内容。

强约束（必须全部遵守）：

【输出格式】
1. 只输出严格 JSON，不要包含解释、前言、代码围栏或额外文字。
2. JSON 格式如下：
{
  "theme": "mistake-review",
  "plan": [
    {
      "layout": "content",
      "templateId": "choice-batch-review",
      "kind": "question-choice",
      "title": "选择题第1组",
      "goal": "讲评本组选择题的题干和选项信息",
      "density": "medium",
      "regions": ["question", "options", "tips"]
    }
  ]
}

【字段规则】
3. layout 只能是 "title"、"content"、"summary"。
4. kind 优先使用："cover"、"question-choice"、"question-material"、"question-answer"、"summary"。
5. templateId 优先从下方模板参考中选择，并保持与 kind/layout/regions 一致。
6. density 只能是 "light"、"medium"、"dense"。
7. regions 只能从以下值中选择："lead"、"question"、"options"、"material"、"analysis"、"answer"、"tips"、"summary"。
8. goal 用一句中文说明本页讲评任务，不超过 30 字。

【规划要求】
9. 如果用户明确给出页数要求，必须严格按要求规划。
10. 选择题批量讲评时，可按 1 题 1 页或 2-3 题 1 页分组，但要服从用户页数要求。
11. 材料题应优先使用 "material-question-review"，通常一段材料对应一页。
12. 参考答案类资料优先转化为 tips 区域的作答提醒，不必单独规划 answer 区域，除非用户明确要求展示答案。
13. 如用户提到“动画”“红框标示”，在 goal 中体现“突出答案/分步揭示”，但不要新增 schema 字段。`,
    contentPrompt: `你是一位专业的试卷讲评课件设计师。请根据用户提供的试题、材料和参考答案，生成适合课堂讲评的课件。

强约束（必须全部遵守）：

【输出格式——最重要】
1. 只输出严格 JSON，不要包含任何解释、前言、代码围栏或额外文字。
2. JSON 格式如下：
{
  "theme": "mistake-review",
  "slides": [
    {
      "layout": "content",
      "templateId": "choice-batch-review",
      "kind": "question-choice",
      "title": "选择题第1组",
      "elements": [
        { "type": "text", "region": "question", "content": "题干全文，保留完整设问与限定条件" },
        { "type": "list", "region": "options", "items": ["A. 区域交流与互鉴", "B. 多元文明同步发展", "C. 手工业分工趋同", "D. 自然环境决定演进"] },
        { "type": "list", "region": "tips", "items": ["作答提醒：抓住题干关键词和限定条件"] }
      ]
    }
  ]
}

【内容要求】
3. slides 数量必须与页面规划完全一致。
4. 每页的 layout、kind、templateId、title 要与 plan 对齐。
5. 选择题页优先使用 "question-choice"，材料题页优先使用 "question-material"。
6. 题型页尽量使用短句、列表，不写大段文字。
7. 若用户提供参考答案，可将其转成 tips 区域中的作答提醒、得分点或干扰项分析；只有用户明确要求时才单独输出 answer 区域。
7.1 若用户未提供参考答案或解析资料，禁止自行补写 answer 区域、得分点列表、作答提醒、结论性总结或步骤条目。
8. 若用户要求“红框/动画”，目前只在文案上用“重点答案”“分步揭示”“先显示题目后显示答案”体现，不要伪造动画字段。
8.1 严禁输出占位式假内容，如“题干缺失”“根据规划保留页面”“请补充题干内容”“A. 选项一 / B. 选项二 / C. 选项三 / D. 选项四”等。若识别不出内容，宁可保留图片或留空，也不要编造占位文字。
9. 材料题页结构建议：
   - material：材料原文或摘要
   - question：设问
   - 有答案资料时才输出 answer：标准答案或步骤
   - 有答案资料时才输出 tips：得分点/误区提醒
10. 选择题页结构建议：
   - question：完整题干，优先使用一个 text 元素，避免拆成过多短句
   - options：选项
   - tips：干扰项分析或作答提醒

【文字密度控制】
11. title 不超过 15 个汉字。
12. 每条 list item 不超过 28 个汉字；但 question 区若使用 text，可保留完整题干。
13. 单页 list 总条数尽量不超过 8 条。
14. 内容过多时拆页，不要硬塞。`
  }
}

export interface SlidePlanItem {
  layout: 'title' | 'content' | 'summary'
  kind?: string
  templateId?: string
  title?: string
  goal: string
  density: 'light' | 'medium' | 'dense'
  regions?: string[]
}

export interface SlidePlanDocument {
  theme: string
  plan: SlidePlanItem[]
}

const DENSITY_ELEMENT_LIMITS: Record<SlidePlanItem['density'], number> = {
  light: 4,
  medium: 6,
  dense: 8
}

const VALID_PLAN_REGIONS: SlideRegion[] = [
  'hero',
  'lead',
  'body',
  'question',
  'options',
  'material',
  'analysis',
  'answer',
  'tips',
  'summary',
  'footer'
]

export function buildPlanningSystemPrompt(scene: SceneType): string {
  return `${SCENE_CONFIGS[scene].planningPrompt}

【可复用页面模板参考】
${buildTemplateReference(scene)}`
}

export function buildContentSystemPrompt(scene: SceneType, planDocument: SlidePlanDocument): string {
  const scenePrompt = SCENE_CONFIGS[scene].contentPrompt
  return `${scenePrompt}

【页面规划结果——必须遵守】
以下是已经确认的页面规划。你必须严格按照该规划输出最终 slides：
${JSON.stringify(planDocument, null, 2)}

附加要求：
1. slides 数量必须与 plan 数量完全一致。
2. 每页的 layout、kind、title 应与 plan 对应项一致；若 title 需要微调，只允许做很小幅度润色。
3. 每页 elements 的 region 应尽量只使用 plan 中声明的区域。
4. 不允许擅自新增无关页面或合并页面。

【优先复用模板】
${buildTemplateReference(scene)}`
}

export function parseSlidePlan(raw: string, fallbackTheme: string): SlidePlanDocument | null {
  try {
    let cleaned = raw.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    }

    const parsed = JSON.parse(cleaned) as Partial<SlidePlanDocument>
    if (!parsed || !Array.isArray(parsed.plan) || parsed.plan.length === 0) {
      return null
    }

    const validPlan = parsed.plan.filter(isValidPlanItem)
    if (validPlan.length === 0 || validPlan.length !== parsed.plan.length) {
      return null
    }

    return {
      theme: typeof parsed.theme === 'string' ? parsed.theme : fallbackTheme,
      plan: validPlan
    }
  } catch {
    return null
  }
}

export function reconcileSlidesWithPlan(
  slides: Slide[],
  planDocument: SlidePlanDocument
): Slide[] {
  return planDocument.plan.map((planItem, index) => {
    const source = slides[index]
    const allowedRegions = new Set(planItem.regions ?? [])
    const template = getSlideTemplate(planItem.templateId)
    const maxElements = template?.maxElements ?? DENSITY_ELEMENT_LIMITS[planItem.density]
    const nextKind = normalizePlanKind(planItem.kind) ?? source?.kind
    const nextTitle = planItem.title?.trim() || source?.title || planItem.goal

    const nextElements = reconcileElementsWithTemplate(
      source?.elements ?? [],
      allowedRegions,
      template,
      maxElements
    )

    return {
      layout: planItem.layout,
      kind: nextKind,
      templateId: template?.id ?? source?.templateId,
      title: nextTitle,
      subtitle: source?.subtitle,
      elements: nextElements
    }
  })
}

function reconcileElementsWithTemplate(
  elements: Slide['elements'],
  allowedRegions: Set<string>,
  template: SlideTemplateSpec | null,
  maxElements: number
): Slide['elements'] {
  const filtered = elements.filter((element) => {
    if (allowedRegions.size === 0) return true
    return !element.region || allowedRegions.has(element.region)
  })

  if (!template) {
    return filtered.slice(0, maxElements)
  }

  const preferredTypes = new Set(template.preferredElementTypes)
  const preferredElements = filtered.filter((element) => preferredTypes.has(element.type))
  const fallbackElements = filtered.filter((element) => !preferredTypes.has(element.type))
  const ordered = orderElementsByTemplateStrategy(
    preferredElements.length > 0 ? preferredElements : filtered,
    template
  )

  const reconciled = [...ordered, ...fallbackElements]
  return preserveCriticalStructuredContent(reconciled, template, maxElements)
}

function preserveCriticalStructuredContent(
  elements: Slide['elements'],
  template: SlideTemplateSpec,
  maxElements: number
): Slide['elements'] {
  if (elements.length <= maxElements) return elements

  const criticalRegions = getCriticalRegions(template.kind)
  if (criticalRegions.length === 0) {
    return elements.slice(0, maxElements)
  }

  const criticalElements = elements.filter((element) =>
    Boolean(element.region && criticalRegions.includes(element.region))
  )
  const optionalElements = elements.filter((element) =>
    !element.region || !criticalRegions.includes(element.region)
  )

  if (criticalElements.length >= maxElements) {
    return criticalElements
  }

  return [...criticalElements, ...optionalElements.slice(0, maxElements - criticalElements.length)]
}

function getCriticalRegions(kind: SlideTemplateSpec['kind']): string[] {
  switch (kind) {
    case 'question-choice':
      return ['question', 'options', 'material']
    case 'question-material':
      return ['material', 'question']
    case 'question-answer':
      return ['question', 'analysis', 'answer']
    default:
      return []
  }
}

function orderElementsByTemplateStrategy(
  elements: Slide['elements'],
  template: SlideTemplateSpec
): Slide['elements'] {
  switch (template.fallbackSplitStrategy) {
    case 'list-first':
      return elements.slice().sort((left, right) => {
        const leftScore = left.type === 'list' ? 0 : left.type === 'heading' ? 1 : 2
        const rightScore = right.type === 'list' ? 0 : right.type === 'heading' ? 1 : 2
        return leftScore - rightScore
      })
    case 'region-first':
      return elements.slice().sort((left, right) => {
        const leftIndex = left.region ? template.regions.indexOf(left.region) : Number.MAX_SAFE_INTEGER
        const rightIndex = right.region ? template.regions.indexOf(right.region) : Number.MAX_SAFE_INTEGER
        if (leftIndex !== rightIndex) return leftIndex - rightIndex
        return left.type.localeCompare(right.type)
      })
    case 'balanced':
    default:
      return elements
  }
}

function isValidPlanItem(item: unknown): item is SlidePlanItem {
  if (typeof item !== 'object' || item === null) return false
  const value = item as Record<string, unknown>
  return (
    (value.layout === 'title' || value.layout === 'content' || value.layout === 'summary') &&
    typeof value.goal === 'string' &&
    (value.density === 'light' || value.density === 'medium' || value.density === 'dense') &&
      (value.kind === undefined || typeof value.kind === 'string') &&
      (value.templateId === undefined || typeof value.templateId === 'string') &&
      (value.title === undefined || typeof value.title === 'string') &&
    (value.regions === undefined ||
      (Array.isArray(value.regions) &&
        value.regions.every(
          (region) =>
            typeof region === 'string' &&
            VALID_PLAN_REGIONS.includes(region as SlideRegion)
        )))
  )
}

function normalizePlanKind(kind: string | undefined): SlideKind | undefined {
  switch (kind) {
    case 'cover':
    case 'section':
    case 'knowledge-points':
    case 'question-choice':
    case 'question-material':
    case 'question-answer':
    case 'explanation':
    case 'summary':
      return kind
    default:
      return undefined
  }
}

function buildTemplateReference(scene: SceneType): string {
  return getSceneTemplates(scene as SlideScene)
    .map((template) => {
      return formatTemplateReference(template)
    })
    .join('\n')
}

function formatTemplateReference(template: SlideTemplateSpec): string {
  const regionList = template.regions.join(' / ')
  return `- ${template.label}：templateId=${template.id}，layout=${template.layout}，kind=${template.kind}，density=${template.density}，regions=${regionList}，适用=${template.useCase}`
}
