<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import type { Project } from '@/types'

defineProps<{ project: Project }>()
</script>

<template>
  <article class="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-5">
    <h3 class="text-lg font-semibold">{{ project.name }}</h3>
    <p class="text-sm text-surface-600">{{ project.description }}</p>
    <div class="flex flex-wrap gap-2">
      <Tag v-for="tag in project.tags" :key="tag" :value="tag" severity="secondary" />
    </div>
    <ProgressBar :value="project.progress" class="mt-auto" />
  </article>
</template>
