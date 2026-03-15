<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { X, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'
import { LLM_CONFIGS, type LLMProvider } from '@/types/llm'
import { streamChat } from '@/services/llmService'

const emit = defineEmits<{ close: [] }>()

const settingsStore = useSettingsStore()

const providers: LLMProvider[] = ['deepseek', 'doubao', 'qianwen']

const selectedProvider = ref<LLMProvider>(settingsStore.currentProvider)
const apiKey = ref('')
const selectedModel = ref(settingsStore.currentModel)
const showKey = ref(false)

const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const testMessage = ref('')

const visible = ref(false)

onMounted(async () => {
  await settingsStore.loadApiKeyForProvider(selectedProvider.value)
  apiKey.value = settingsStore.apiKeys[selectedProvider.value]
  selectedModel.value = settingsStore.currentModel
  requestAnimationFrame(() => {
    visible.value = true
  })
})

watch(selectedProvider, async (provider) => {
  await settingsStore.loadApiKeyForProvider(provider)
  apiKey.value = settingsStore.apiKeys[provider]
  selectedModel.value = LLM_CONFIGS[provider].defaultModel
  testStatus.value = 'idle'
  testMessage.value = ''
  showKey.value = false
})

function handleClose() {
  visible.value = false
  setTimeout(() => emit('close'), 200)
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

async function testConnection() {
  if (!apiKey.value) {
    testStatus.value = 'error'
    testMessage.value = '请先输入 API Key'
    return
  }

  testStatus.value = 'testing'
  testMessage.value = ''

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
    testStatus.value = 'error'
    testMessage.value = '连接超时'
  }, 10000)

  try {
    await streamChat(selectedProvider.value, apiKey.value, [
      { role: 'user', content: 'Hi' }
    ], {
      onChunk() {
        // Received data — connection works
        clearTimeout(timeout)
        testStatus.value = 'success'
        testMessage.value = '连接成功'
      },
      onDone() {
        clearTimeout(timeout)
        if (testStatus.value !== 'success') {
          testStatus.value = 'success'
          testMessage.value = '连接成功'
        }
      },
      onError(err) {
        clearTimeout(timeout)
        if (err.message === '请求已取消' && testMessage.value === '连接超时') {
          return
        }
        testStatus.value = 'error'
        testMessage.value = err.message || '连接失败'
      }
    }, undefined, { signal: controller.signal })
  } catch (err) {
    clearTimeout(timeout)
    testStatus.value = 'error'
    testMessage.value = err instanceof Error ? err.message : '连接失败'
  }
}

async function handleSave() {
  settingsStore.setProvider(selectedProvider.value)
  settingsStore.setApiKey(selectedProvider.value, apiKey.value)
  settingsStore.setModel(selectedModel.value)
  await settingsStore.saveSettings()
  handleClose()
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex justify-end"
      :class="visible ? 'bg-black/20' : 'bg-transparent'"
      style="transition: background-color 200ms ease"
      @click="handleOverlayClick"
    >
      <div
        class="h-full w-[480px] border-l bg-surface"
        :class="visible ? 'translate-x-0' : 'translate-x-full'"
        style="transition: transform 200ms ease"
      >
        <div class="flex h-full flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between border-b px-6 py-4">
            <h2 class="text-base font-medium text-text-primary">设置</h2>
            <button
              class="inline-flex items-center justify-center rounded p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]"
              @click="handleClose"
            >
              <X :size="18" :stroke-width="1.5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="space-y-6">
              <!-- Provider selection -->
              <div>
                <label class="mb-2 block text-xs font-medium tracking-wide text-text-secondary">
                  AI 服务商
                </label>
                <div class="flex gap-2">
                  <button
                    v-for="p in providers"
                    :key="p"
                    class="rounded px-3 py-1.5 text-sm transition-colors duration-150 active:scale-[0.98]"
                    :class="
                      selectedProvider === p
                        ? 'bg-accent text-white'
                        : 'bg-page text-text-secondary hover:text-text-primary'
                    "
                    @click="selectedProvider = p"
                  >
                    {{ LLM_CONFIGS[p].name }}
                  </button>
                </div>
              </div>

              <!-- API Key -->
              <div>
                <label class="mb-2 block text-xs font-medium tracking-wide text-text-secondary">
                  API Key
                </label>
                <div class="relative">
                  <input
                    v-model="apiKey"
                    :type="showKey ? 'text' : 'password'"
                    placeholder="输入 API Key"
                    class="w-full rounded border bg-page py-2 pl-3 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                  />
                  <button
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition-colors duration-150 hover:text-text-secondary"
                    @click="showKey = !showKey"
                  >
                    <Eye v-if="!showKey" :size="16" :stroke-width="1.5" />
                    <EyeOff v-else :size="16" :stroke-width="1.5" />
                  </button>
                </div>
              </div>

              <!-- Model selection -->
              <div>
                <label class="mb-2 block text-xs font-medium tracking-wide text-text-secondary">
                  模型
                </label>
                <select
                  v-model="selectedModel"
                  class="w-full appearance-none rounded border bg-page px-3 py-2 text-sm text-text-primary transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                >
                  <option
                    v-for="m in LLM_CONFIGS[selectedProvider].models"
                    :key="m"
                    :value="m"
                  >
                    {{ m }}
                  </option>
                </select>
              </div>

              <!-- Test connection -->
              <div>
                <button
                  class="inline-flex items-center gap-2 rounded-[10px] border bg-surface px-5 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-hover active:scale-[0.98]"
                  :disabled="testStatus === 'testing'"
                  :class="testStatus === 'testing' ? 'cursor-not-allowed opacity-50' : ''"
                  @click="testConnection"
                >
                  <Loader2
                    v-if="testStatus === 'testing'"
                    :size="16"
                    :stroke-width="1.5"
                    class="animate-spin"
                  />
                  测试连接
                </button>
                <div
                  v-if="testStatus === 'success' || testStatus === 'error'"
                  class="mt-2 flex items-center gap-1.5 text-sm"
                  :class="testStatus === 'success' ? 'text-success' : 'text-error'"
                >
                  <Check v-if="testStatus === 'success'" :size="14" :stroke-width="1.5" />
                  <AlertCircle v-else :size="14" :stroke-width="1.5" />
                  {{ testMessage }}
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t px-6 py-4">
            <div class="flex justify-end">
              <button
                class="rounded-[10px] bg-accent px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover active:scale-[0.98]"
                @click="handleSave"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
