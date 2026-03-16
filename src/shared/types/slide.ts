export type SlideLayout = 'title' | 'content' | 'summary'

export type SlideKind =
  | 'cover'
  | 'section'
  | 'knowledge-points'
  | 'question-choice'
  | 'question-material'
  | 'question-answer'
  | 'explanation'
  | 'summary'

export type SlideRegion =
  | 'hero'
  | 'lead'
  | 'body'
  | 'question'
  | 'options'
  | 'material'
  | 'analysis'
  | 'answer'
  | 'tips'
  | 'summary'
  | 'footer'

interface SlideElementBase {
  region?: SlideRegion
}

export type SlideElement =
  | (SlideElementBase & { type: 'heading'; level: 2 | 3; content: string })
  | (SlideElementBase & { type: 'text'; content: string })
  | (SlideElementBase & { type: 'list'; ordered?: boolean; items: string[] })
  | (SlideElementBase & { type: 'blockquote'; content: string })
  | (SlideElementBase & { type: 'table'; headers: string[]; rows: string[][] })
  | (SlideElementBase & { type: 'image'; src: string; alt?: string })

export interface Slide {
  layout: SlideLayout
  kind?: SlideKind
  title?: string
  subtitle?: string
  elements: SlideElement[]
}

export interface SlidePresentation {
  theme: string
  slides: Slide[]
}
