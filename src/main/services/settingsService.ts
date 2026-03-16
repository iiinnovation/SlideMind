import { safeStorage } from 'electron'
import Store from 'electron-store'
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences
} from '../../shared/types/settings'

interface StoreSchema {
  encryptedApiKeys: Record<string, string>
  preferences: AppPreferences
}

const store = new Store<StoreSchema>({
  defaults: {
    encryptedApiKeys: {},
    preferences: DEFAULT_APP_PREFERENCES
  }
})

export function saveApiKey(provider: string, key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system')
  }
  const encrypted = safeStorage.encryptString(key)
  const keys = store.get('encryptedApiKeys', {})
  keys[provider] = encrypted.toString('base64')
  store.set('encryptedApiKeys', keys)
}

export function loadApiKey(provider: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return ''
  }
  const keys = store.get('encryptedApiKeys', {})
  const encoded = keys[provider]
  if (!encoded) return ''
  try {
    const buffer = Buffer.from(encoded, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return ''
  }
}

export function deleteApiKey(provider: string): void {
  const keys = store.get('encryptedApiKeys', {})
  delete keys[provider]
  store.set('encryptedApiKeys', keys)
}

export function savePreferences(prefs: AppPreferences): void {
  store.set('preferences', {
    ...DEFAULT_APP_PREFERENCES,
    ...prefs
  })
}

export function loadPreferences(): AppPreferences {
  const prefs = store.get('preferences', DEFAULT_APP_PREFERENCES)
  return {
    ...DEFAULT_APP_PREFERENCES,
    ...prefs
  }
}
