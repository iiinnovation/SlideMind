<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { PanelLeft, Settings } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useSettingsStore } from '../stores/settings'
import { useChatGeneration } from '../composables/useChatGeneration'
import type { UIAttachment } from '@/types/llm'
import LandingPage from '../components/LandingPage.vue'
import ChatPanel from '../components/ChatPanel.vue'
import SlidePreview from '../components/SlidePreview.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import ConversationSidebar from '../components/ConversationSidebar.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const { generate } = useChatGeneration()

const showSettings = ref(false)
const sidebarCollapsed = ref(false)

onMounted(async () => {
  await Promise.all([
    editorStore.initialize(),
    settingsStore.loadSettings()
  ])
})

function handleSend(content: string, attachments?: UIAttachment[]) {
  generate(content, attachments)
}
</script>

<template>
  <div class="flex h-screen flex-col bg-page">
    <div
      class="flex items-center justify-between border-b px-4 py-2"
      style="background: rgba(245, 245, 240, 0.8); backdrop-filter: blur(8px)"
    >
      <h1 class="text-base font-medium text-text-primary">SlideMind</h1>
      <div class="flex items-center gap-1">
        <button
          class="inline-flex items-center justify-center rounded p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <PanelLeft :size="18" :stroke-width="1.5" />
        </button>
        <button
          class="inline-flex items-center justify-center rounded p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary active:scale-[0.98]"
          @click="showSettings = true"
        >
          <Settings :size="18" :stroke-width="1.5" />
        </button>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <ConversationSidebar
        :collapsed="sidebarCollapsed"
        @toggle="sidebarCollapsed = !sidebarCollapsed"
      />

      <div class="relative flex-1 overflow-hidden">
        <Transition name="fade" mode="out-in">
          <div
            v-if="!editorStore.isReady"
            key="loading"
            class="flex h-full items-center justify-center text-sm text-text-muted"
          >
            正在加载会话...
          </div>

          <LandingPage
            v-else-if="!editorStore.hasContent"
            key="landing"
            @send="handleSend"
          />

          <div
            v-else
            key="split"
            class="flex h-full"
          >
            <div class="h-full w-[42%] border-r">
              <ChatPanel @send="handleSend" />
            </div>

            <div class="h-full w-[58%]">
              <SlidePreview
                :slides="editorStore.slides"
                :theme="editorStore.currentTheme"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <SettingsDrawer v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
