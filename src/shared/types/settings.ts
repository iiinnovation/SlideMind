export interface PresentationTypographySettings {
  titleFontFamily: string
  bodyFontFamily: string
  titleFontSize: number
  bodyFontSize: number
}

export interface AppPreferences extends PresentationTypographySettings {
  provider: string
  model: string
}

export const DEFAULT_PRESENTATION_TYPOGRAPHY: PresentationTypographySettings = {
  titleFontFamily: 'Microsoft YaHei',
  bodyFontFamily: 'Microsoft YaHei',
  titleFontSize: 28,
  bodyFontSize: 16
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  ...DEFAULT_PRESENTATION_TYPOGRAPHY
}
