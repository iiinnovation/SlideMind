<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { PanelLeft, Settings } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useSettingsStore } from '../stores/settings'
import { useChatGeneration } from '../composables/useChatGeneration'
import type { UIAttachment } from '@/types/llm'
import LandingPage from '../components/LandingPage.vue'
import ChatPanel from '../components/ChatPanel.vue'
import SlidePreview from '../components/SlidePreview.vue'
import SlideEditorPanel from '../components/SlideEditorPanel.vue'
import SlideThumbnailList from '../components/SlideThumbnailList.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import ConversationSidebar from '../components/ConversationSidebar.vue'

const editorStore = useEditorStore()
const settingsStore = useSettingsStore()
const { generate, stopGeneration } = useChatGeneration()

const showSettings = ref(false)
const sidebarCollapsed = ref(false)
const currentSlideIndex = ref(0)
const hasConversationActivity = ref(false)
const selectedSlideIndices = ref<number[]>([])

onMounted(async () => {
  await Promise.all([
    editorStore.initialize(),
    settingsStore.loadSettings()
  ])
})

function handleSend(content: string, attachments?: UIAttachment[]) {
  generate(content, attachments)
}

watch(
  () => [editorStore.messages.length, editorStore.markdown.length, editorStore.slides.length] as const,
  ([messageCount, markdownLength, slideCount]) => {
    hasConversationActivity.value = messageCount > 0 || markdownLength > 0 || slideCount > 0
  },
  { immediate: true }
)

watch(
  () => [editorStore.activeConversationId, editorStore.slides.length] as const,
  () => {
    if (editorStore.slides.length === 0) {
      currentSlideIndex.value = 0
      selectedSlideIndices.value = []
      return
    }
    if (currentSlideIndex.value >= editorStore.slides.length) {
      currentSlideIndex.value = editorStore.slides.length - 1
    }
    selectedSlideIndices.value = selectedSlideIndices.value
      .filter((index) => index >= 0 && index < editorStore.slides.length)
    if (selectedSlideIndices.value.length === 0) {
      selectedSlideIndices.value = [currentSlideIndex.value]
    }
  },
  { immediate: true }
)

watch(currentSlideIndex, (index) => {
  if (!selectedSlideIndices.value.includes(index)) {
    selectedSlideIndices.value = [index]
  }
})

function handleSlideSelect(index: number) {
  currentSlideIndex.value = index
}

function handleToggleSlideSelection(index: number) {
  if (selectedSlideIndices.value.includes(index)) {
    selectedSlideIndices.value = selectedSlideIndices.value.filter((item) => item !== index)
    if (selectedSlideIndices.value.length === 0) {
      selectedSlideIndices.value = [index]
    }
    return
  }
  selectedSlideIndices.value = [...selectedSlideIndices.value, index].sort((a, b) => a - b)
}

function handleSelectAllSlides() {
  selectedSlideIndices.value = editorStore.slides.map((_, index) => index)
}

function handleClearSlideSelection() {
  selectedSlideIndices.value = editorStore.slides.length > 0 ? [currentSlideIndex.value] : []
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
        <button
          v-if="sidebarCollapsed"
          class="absolute left-3 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white/92 text-text-secondary shadow-sm backdrop-blur transition-all duration-150 hover:border-[#d0b09b] hover:bg-[#fcf7f3] hover:text-text-primary"
          title="展开会话栏"
          @click="sidebarCollapsed = false"
        >
          <PanelLeft :size="18" :stroke-width="1.75" />
        </button>

        <Transition name="fade" mode="out-in">
          <div
            v-if="!editorStore.isReady"
            key="loading"
            class="flex h-full items-center justify-center text-sm text-text-muted"
          >
            正在加载会话...
          </div>

          <LandingPage
            v-else-if="!hasConversationActivity"
            key="landing"
            @send="handleSend"
            @stop="stopGeneration"
          />

          <div
            v-else
            key="split"
            class="flex h-full min-w-0"
          >
            <div class="h-full w-[clamp(260px,26vw,380px)] shrink-0 border-r">
              <ChatPanel @send="handleSend" @stop="stopGeneration" />
            </div>

            <div class="flex h-full min-w-0 flex-1">
              <template v-if="editorStore.slides.length > 0">
                <SlideThumbnailList
                  :slides="editorStore.slides"
                  :current-slide-index="currentSlideIndex"
                  :selected-slide-indices="selectedSlideIndices"
                  @select="handleSlideSelect"
                  @toggle-select="handleToggleSlideSelection"
                  @select-all="handleSelectAllSlides"
                  @clear-selection="handleClearSlideSelection"
                />
                <div class="min-w-0 flex-1">
                  <SlidePreview
                    :slides="editorStore.slides"
                    :theme="editorStore.currentTheme"
                    :current-slide-index="currentSlideIndex"
                    @update:current-slide-index="currentSlideIndex = $event"
                  />
                </div>
                <SlideEditorPanel
                  :slides="editorStore.slides"
                  :current-slide-index="currentSlideIndex"
                  :selected-slide-indices="selectedSlideIndices"
                  @update:current-slide-index="currentSlideIndex = $event"
                />
              </template>

              <div
                v-else
                class="flex flex-1 items-center justify-center border-l bg-[#fcfbf8] px-8"
              >
                <div class="max-w-sm text-center">
                  <div class="text-sm font-medium text-text-primary">
                    {{ editorStore.isGenerating ? '正在生成课件预览' : '预览尚未生成' }}
                  </div>
                  <p class="mt-2 text-sm text-text-muted">
                    {{ editorStore.isGenerating
                      ? '页面规划完成后，预览会在这里逐页出现，不再提前显示空白缩略列表和编辑面板。'
                      : '继续发送生成指令，或新增页面后，这里会显示课件预览和编辑工作区。'
                    }}
                  </p>
                </div>
              </div>
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
