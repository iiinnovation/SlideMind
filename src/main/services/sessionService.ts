import Store from 'electron-store'
import type { EditorStateSnapshot } from '../../shared/types/session'

interface SessionStoreSchema {
  editorState: EditorStateSnapshot
}

const defaultState: EditorStateSnapshot = {
  conversations: [],
  activeConversationId: null
}

const sessionStore = new Store<SessionStoreSchema>({
  name: 'slidemind-sessions',
  defaults: {
    editorState: defaultState
  }
})

export function saveEditorState(snapshot: EditorStateSnapshot): void {
  sessionStore.set('editorState', snapshot)
}

export function loadEditorState(): EditorStateSnapshot {
  return sessionStore.get('editorState', defaultState)
}
