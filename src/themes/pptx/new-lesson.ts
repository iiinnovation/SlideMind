import PptxGenJS from 'pptxgenjs'

export interface PptxThemeConfig {
  background: { color: string } | { path: string }
  title: Partial<PptxGenJS.TextPropsOptions>
  subtitle: Partial<PptxGenJS.TextPropsOptions>
  body: Partial<PptxGenJS.TextPropsOptions>
  bullet: Partial<PptxGenJS.TextPropsOptions>
  classOverrides?: Record<string, Partial<PptxClassOverride>>
}

export interface PptxClassOverride {
  background: { color: string } | { path: string }
  title: Partial<PptxGenJS.TextPropsOptions>
  subtitle: Partial<PptxGenJS.TextPropsOptions>
  body: Partial<PptxGenJS.TextPropsOptions>
  bullet: Partial<PptxGenJS.TextPropsOptions>
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
    },
    'tpl-cover-hero': {
      title: {
        fontSize: 40,
        align: 'center'
      },
      subtitle: {
        fontSize: 24,
        align: 'center'
      }
    },
    'tpl-section-break': {
      background: { color: 'F8F3EC' }
    },
    'tpl-knowledge-bullets': {},
    'tpl-knowledge-compare': {},
    'tpl-example-explanation': {},
    'tpl-method-summary': {},
    'tpl-experiment-steps': {},
    'tpl-summary-close': {
      subtitle: {
        fontSize: 24,
        color: 'AE5630'
      }
    }
  }
}
