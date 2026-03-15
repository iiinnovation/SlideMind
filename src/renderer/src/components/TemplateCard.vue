<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

const props = defineProps<{
  name: string
  description: string
  icon: Component
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <button
    class="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.98]"
    :class="selected
      ? 'border-accent border-2 bg-accent/5'
      : 'bg-surface hover:border-strong'"
    @click="emit('select')"
  >
    <div
      class="inline-flex items-center justify-center rounded-lg p-2"
      :class="selected ? 'bg-accent/10 text-accent' : 'bg-surface-hover text-text-secondary'"
    >
      <component :is="props.icon" :size="20" :stroke-width="1.5" />
    </div>
    <div>
      <div class="text-sm font-medium text-text-primary">{{ name }}</div>
      <div class="mt-0.5 text-xs text-text-secondary">{{ description }}</div>
    </div>
  </button>
</template>
