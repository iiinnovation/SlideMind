import type { PptxThemeConfig } from './new-lesson'

export const mistakeReviewPptxTheme: PptxThemeConfig = {
  background: { color: 'FFFFFF' },
  title: {
    fontSize: 32,
    bold: false,
    color: '1A1A18',
    fontFace: 'Microsoft YaHei'
  },
  subtitle: {
    fontSize: 22,
    bold: false,
    color: 'AE5630',
    fontFace: 'Microsoft YaHei'
  },
  body: {
    fontSize: 16,
    color: '37362F',
    fontFace: 'Microsoft YaHei'
  },
  bullet: {
    fontSize: 15,
    color: '37362F',
    fontFace: 'Microsoft YaHei',
    bullet: true
  },
  classOverrides: {
    'tpl-mistake-cover': {
      title: {
        fontSize: 34
      },
      subtitle: {
        fontSize: 22,
        color: 'AE5630'
      }
    },
    'tpl-choice-diagnosis': {},
    'tpl-material-diagnosis': {},
    'tpl-answer-diagnosis': {},
    'tpl-mistake-patterns': {},
    'tpl-qa-review': {},
    'tpl-mistake-summary': {
      subtitle: {
        fontSize: 22,
        color: 'AE5630'
      }
    }
  }
}
