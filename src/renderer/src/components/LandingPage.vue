<script setup lang="ts">
import { BookOpen, FileQuestion } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { SCENE_CONFIGS, type SceneType } from '../services/promptService'
import TemplateCard from './TemplateCard.vue'
import ChatInput from './ChatInput.vue'
import type { UIAttachment } from '@/types/llm'

const editorStore = useEditorStore()

const emit = defineEmits<{
  send: [content: string, attachments: UIAttachment[]]
}>()

const sceneIcons: Record<SceneType, typeof BookOpen> = {
  'new-lesson': BookOpen,
  'mistake-review': FileQuestion
}

const sceneKeys = Object.keys(SCENE_CONFIGS) as SceneType[]
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-6">
    <!-- Brand -->
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-medium text-text-primary">SlideMind</h1>
      <p class="mt-1.5 text-sm text-text-secondary">AI 驱动的教师专属课件生成器</p>
    </div>

    <!-- Template cards -->
    <div class="mb-8 flex gap-4">
      <TemplateCard
        v-for="key in sceneKeys"
        :key="key"
        :name="SCENE_CONFIGS[key].name"
        :description="SCENE_CONFIGS[key].description"
        :icon="sceneIcons[key]"
        :selected="editorStore.currentScene === key"
        @select="editorStore.setScene(key)"
      />
    </div>

    <!-- Chat input -->
    <div class="w-full max-w-2xl">
      <ChatInput
        :disabled="editorStore.isGenerating"
        placeholder="描述你的课件需求，例如：帮我生成一份《三角函数》的课件..."
        @send="(content, attachments) => emit('send', content, attachments)"
      />
    </div>
  </div>
</template>
