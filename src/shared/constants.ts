/**
 * IPC channel names shared between main and renderer processes
 */
export const IPC_CHANNELS = {
  EXPORT_PPTX: 'export:pptx',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  SETTINGS_SAVE_API_KEY: 'settings:saveApiKey',
  SETTINGS_LOAD_API_KEY: 'settings:loadApiKey',
  SETTINGS_DELETE_API_KEY: 'settings:deleteApiKey',
  SETTINGS_SAVE_PREFERENCES: 'settings:savePreferences',
  SETTINGS_LOAD_PREFERENCES: 'settings:loadPreferences',
  SESSION_SAVE_STATE: 'session:saveState',
  SESSION_LOAD_STATE: 'session:loadState',
  FILE_SELECT: 'file:select',
  FILE_PARSE: 'file:parse'
} as const

/**
 * Scene types
 */
export type SceneType = 'new-lesson' | 'mistake-review'
