import type { EditorStateSnapshot } from '../../../shared/types/session'
import type { FileParseResult } from '../../../shared/types/attachment'
import type { Slide } from '../../../shared/types/slide'

export interface ExportResult {
  success: boolean
  filePath?: string
  reason?: string
}

export interface ElectronAPI {
  exportPptx: (slides: Slide[], themeName: string) => Promise<ExportResult>
  openFileDialog: () => Promise<string | null>
  saveApiKey: (provider: string, key: string) => Promise<void>
  loadApiKey: (provider: string) => Promise<string>
  deleteApiKey: (provider: string) => Promise<void>
  savePreferences: (prefs: { provider: string; model: string }) => Promise<void>
  loadPreferences: () => Promise<{ provider: string; model: string }>
  saveEditorState: (snapshot: EditorStateSnapshot) => Promise<void>
  loadEditorState: () => Promise<EditorStateSnapshot>
  selectFiles: () => Promise<string[]>
  parseFile: (filePath: string) => Promise<FileParseResult>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
