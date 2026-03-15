import type { TextPropsOptions } from 'pptxgenjs'

export interface PptxThemeConfig {
  background: { color: string } | { path: string }
  title: Partial<TextPropsOptions>
  subtitle: Partial<TextPropsOptions>
  body: Partial<TextPropsOptions>
  bullet: Partial<TextPropsOptions>
  classOverrides?: Record<string, Partial<PptxClassOverride>>
}

export interface PptxClassOverride {
  background: { color: string } | { path: string }
  title: Partial<TextPropsOptions>
  subtitle: Partial<TextPropsOptions>
  body: Partial<TextPropsOptions>
  bullet: Partial<TextPropsOptions>
}

export const newLessonPptxTheme: PptxThemeConfig = {
  background: { color: 'FAFAF8' },
  title: {
    fontSize: 36,
    bold: false,
    color: '1A1A18',
    fontFace: 'Microsoft YaHei'
  },
  subtitle: {
    fontSize: 24,
    bold: false,
    color: '6B6A68',
    fontFace: 'Microsoft YaHei'
  },
  body: {
    fontSize: 18,
    color: '37362F',
    fontFace: 'Microsoft YaHei'
  },
  bullet: {
    fontSize: 16,
    color: '37362F',
    fontFace: 'Microsoft YaHei',
    bullet: true
  },
  classOverrides: {
    title: {
      title: {
        fontSize: 40,
        bold: false,
        color: '1A1A18',
        fontFace: 'Microsoft YaHei',
        align: 'center'
      },
      subtitle: {
        fontSize: 24,
        bold: false,
        color: '6B6A68',
        fontFace: 'Microsoft YaHei',
        align: 'center'
      }
    },
    summary: {
      subtitle: {
        fontSize: 24,
        bold: false,
        color: 'AE5630',
        fontFace: 'Microsoft YaHei'
      }
    }
  }
}
