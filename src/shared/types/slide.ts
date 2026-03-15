export type SlideElement =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'text'; content: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'blockquote'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; src: string; alt?: string }

export interface Slide {
  layout: 'title' | 'content' | 'summary'
  title?: string
  subtitle?: string
  elements: SlideElement[]
}

export interface SlidePresentation {
  theme: string
  slides: Slide[]
}
