import { contextBridge, ipcRenderer } from 'electron'
import type { EditorStateSnapshot } from '../shared/types/session'
import type { FileParseResult } from '../shared/types/attachment'
import type { Slide } from '../shared/types/slide'

export interface ExportResult {
  success: boolean
  filePath?: string
  reason?: string
}

const api = {
  exportPptx: (slides: Slide[], themeName: string): Promise<ExportResult> =>
    ipcRenderer.invoke('export:pptx', slides, themeName),

  openFileDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFile'),

  saveApiKey: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('settings:saveApiKey', provider, key),

  loadApiKey: (provider: string): Promise<string> =>
    ipcRenderer.invoke('settings:loadApiKey', provider),

  deleteApiKey: (provider: string): Promise<void> =>
    ipcRenderer.invoke('settings:deleteApiKey', provider),

  savePreferences: (prefs: { provider: string; model: string }): Promise<void> =>
    ipcRenderer.invoke('settings:savePreferences', prefs),

  loadPreferences: (): Promise<{ provider: string; model: string }> =>
    ipcRenderer.invoke('settings:loadPreferences'),

  saveEditorState: (snapshot: EditorStateSnapshot): Promise<void> =>
    ipcRenderer.invoke('session:saveState', snapshot),

  loadEditorState: (): Promise<EditorStateSnapshot> =>
    ipcRenderer.invoke('session:loadState'),

  selectFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('file:select'),

  parseFile: (filePath: string): Promise<FileParseResult> =>
    ipcRenderer.invoke('file:parse', filePath)
}

contextBridge.exposeInMainWorld('api', api)
