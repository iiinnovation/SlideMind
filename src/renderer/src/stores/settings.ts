import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LLMProvider } from '@/types/llm'
import { LLM_CONFIGS } from '@/types/llm'
import {
  DEFAULT_PRESENTATION_TYPOGRAPHY
} from '../../../shared/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const currentProvider = ref<LLMProvider>('deepseek')
  const currentModel = ref<string>(LLM_CONFIGS['deepseek'].defaultModel)
  const presentationTitleFontFamily = ref<string>(DEFAULT_PRESENTATION_TYPOGRAPHY.titleFontFamily)
  const presentationBodyFontFamily = ref<string>(DEFAULT_PRESENTATION_TYPOGRAPHY.bodyFontFamily)
  const presentationTitleFontSize = ref<number>(DEFAULT_PRESENTATION_TYPOGRAPHY.titleFontSize)
  const presentationBodyFontSize = ref<number>(DEFAULT_PRESENTATION_TYPOGRAPHY.bodyFontSize)
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

  function setPresentationTitleFontFamily(fontFamily: string) {
    presentationTitleFontFamily.value = fontFamily
  }

  function setPresentationBodyFontFamily(fontFamily: string) {
    presentationBodyFontFamily.value = fontFamily
  }

  function setPresentationTitleFontSize(fontSize: number) {
    presentationTitleFontSize.value = fontSize
  }

  function setPresentationBodyFontSize(fontSize: number) {
    presentationBodyFontSize.value = fontSize
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
    presentationTitleFontFamily.value =
      prefs.titleFontFamily || DEFAULT_PRESENTATION_TYPOGRAPHY.titleFontFamily
    presentationBodyFontFamily.value =
      prefs.bodyFontFamily || DEFAULT_PRESENTATION_TYPOGRAPHY.bodyFontFamily
    presentationTitleFontSize.value =
      prefs.titleFontSize || DEFAULT_PRESENTATION_TYPOGRAPHY.titleFontSize
    presentationBodyFontSize.value =
      prefs.bodyFontSize || DEFAULT_PRESENTATION_TYPOGRAPHY.bodyFontSize

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
      model: currentModel.value,
      titleFontFamily: presentationTitleFontFamily.value,
      bodyFontFamily: presentationBodyFontFamily.value,
      titleFontSize: presentationTitleFontSize.value,
      bodyFontSize: presentationBodyFontSize.value
    })
  }

  return {
    currentProvider,
    currentModel,
    presentationTitleFontFamily,
    presentationBodyFontFamily,
    presentationTitleFontSize,
    presentationBodyFontSize,
    apiKeys,
    setProvider,
    setApiKey,
    setModel,
    setPresentationTitleFontFamily,
    setPresentationBodyFontFamily,
    setPresentationTitleFontSize,
    setPresentationBodyFontSize,
    loadSettings,
    loadApiKeyForProvider,
    saveSettings
  }
})
