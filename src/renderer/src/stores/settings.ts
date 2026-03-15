import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LLMProvider } from '@/types/llm'
import { LLM_CONFIGS } from '@/types/llm'

export const useSettingsStore = defineStore('settings', () => {
  const currentProvider = ref<LLMProvider>('deepseek')
  const currentModel = ref<string>(LLM_CONFIGS['deepseek'].defaultModel)
  const apiKeys = ref<Record<LLMProvider, string>>({
    deepseek: '',
    doubao: '',
    qianwen: ''
  })

  function setProvider(provider: LLMProvider) {
    currentProvider.value = provider
  }

  function setApiKey(provider: LLMProvider, key: string) {
    apiKeys.value[provider] = key
  }

  function setModel(model: string) {
    currentModel.value = model
  }

  function getElectronApi() {
    if (!window.api) {
      throw new Error('Electron preload API is unavailable. Check BrowserWindow preload configuration.')
    }
    return window.api
  }

  async function loadSettings() {
    const api = getElectronApi()
    const prefs = await api.loadPreferences()
    const provider = prefs.provider as LLMProvider
    if (provider in LLM_CONFIGS) {
      currentProvider.value = provider
    }
    currentModel.value = prefs.model || LLM_CONFIGS[currentProvider.value].defaultModel

    const key = await api.loadApiKey(currentProvider.value)
    apiKeys.value[currentProvider.value] = key
  }

  async function loadApiKeyForProvider(provider: LLMProvider) {
    const api = getElectronApi()
    const key = await api.loadApiKey(provider)
    apiKeys.value[provider] = key
  }

  async function saveSettings() {
    const api = getElectronApi()
    const provider = currentProvider.value
    const key = apiKeys.value[provider]
    if (key) {
      await api.saveApiKey(provider, key)
    } else {
      await api.deleteApiKey(provider)
    }
    await api.savePreferences({
      provider,
      model: currentModel.value
    })
  }

  return {
    currentProvider,
    currentModel,
    apiKeys,
    setProvider,
    setApiKey,
    setModel,
    loadSettings,
    loadApiKeyForProvider,
    saveSettings
  }
})
