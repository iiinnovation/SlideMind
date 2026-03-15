import { safeStorage } from 'electron'
import Store from 'electron-store'

interface StoreSchema {
  encryptedApiKeys: Record<string, string>
  preferences: {
    provider: string
    model: string
  }
}

const store = new Store<StoreSchema>({
  defaults: {
    encryptedApiKeys: {},
    preferences: {
      provider: 'deepseek',
      model: 'deepseek-chat'
    }
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

export function savePreferences(prefs: { provider: string; model: string }): void {
  store.set('preferences', prefs)
}

export function loadPreferences(): { provider: string; model: string } {
  return store.get('preferences', { provider: 'deepseek', model: 'deepseek-chat' })
}
