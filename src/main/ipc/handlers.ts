import { ipcMain, dialog } from 'electron'
import { exportToPptx } from '../services/exportService'
import { parseFile } from '../services/fileParseService'
import {
  saveApiKey,
  loadApiKey,
  deleteApiKey,
  savePreferences,
  loadPreferences
} from '../services/settingsService'
import { loadEditorState, saveEditorState } from '../services/sessionService'
import { IPC_CHANNELS } from '../../shared/constants'
import type { EditorStateSnapshot } from '../../shared/types/session'
import type { Slide } from '../../shared/types/slide'

export function registerIpcHandlers(): void {
  ipcMain.handle('export:pptx', async (_event, slides: Slide[], themeName: string) => {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出课件',
      defaultPath: 'slideshow.pptx',
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }]
    })

    if (!filePath) {
      return { success: false, reason: 'cancelled' }
    }

    try {
      await exportToPptx(slides, themeName, filePath)
      return { success: true, filePath }
    } catch (error) {
      return { success: false, reason: String(error) }
    }
  })

  ipcMain.handle('dialog:openFile', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
      ]
    })
    return filePaths[0] ?? null
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE_API_KEY,
    (_event, provider: string, key: string) => {
      saveApiKey(provider, key)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_LOAD_API_KEY,
    (_event, provider: string) => {
      return loadApiKey(provider)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_DELETE_API_KEY,
    (_event, provider: string) => {
      deleteApiKey(provider)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE_PREFERENCES,
    (_event, prefs: { provider: string; model: string }) => {
      savePreferences(prefs)
    }
  )

  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD_PREFERENCES, () => {
    return loadPreferences()
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE_STATE, (_event, snapshot: EditorStateSnapshot) => {
    saveEditorState(snapshot)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD_STATE, () => {
    return loadEditorState()
  })

  ipcMain.handle(IPC_CHANNELS.FILE_SELECT, async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: '支持的文件',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'docx', 'txt', 'md']
        }
      ]
    })
    return filePaths
  })

  ipcMain.handle(IPC_CHANNELS.FILE_PARSE, async (_event, filePath: string) => {
    return parseFile(filePath)
  })
}
