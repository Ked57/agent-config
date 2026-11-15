<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import ProjectCard from '@/components/ProjectCard.vue'
import { fetchProjects } from '@/services/api'
import type { Project } from '@/types'

const projects = ref<Project[]>([])
const showFilters = ref(true)
const activeTag = ref<string | null>(null)

const tags = computed(() => [...new Set(projects.value.flatMap((project) => project.tags))].sort())
const visible = computed(() =>
  activeTag.value ? projects.value.filter((project) => project.tags.includes(activeTag.value as string)) : projects.value,
)

onMounted(async () => {
  projects.value = await fetchProjects()
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Projects</h1>
      <Button :label="showFilters ? 'Hide filters' : 'Show filters'" severity="secondary" outlined @click="showFilters = !showFilters" />
    </div>
    <div class="flex gap-6">
      <aside v-if="showFilters" class="w-64 shrink-0 rounded-xl border border-surface-200 bg-surface-0 p-4">
        <h2 class="mb-3 font-semibold">Tags</h2>
        <ul class="flex flex-col gap-1">
          <li>
            <button type="button" class="w-full rounded px-2 py-1 text-left hover:bg-surface-100" :class="{ 'font-semibold': !activeTag }" @click="activeTag = null">All</button>
          </li>
          <li v-for="tag in tags" :key="tag">
            <button type="button" class="w-full rounded px-2 py-1 text-left hover:bg-surface-100" :class="{ 'font-semibold': activeTag === tag }" @click="activeTag = tag">{{ tag }}</button>
          </li>
        </ul>
      </aside>
      <div class="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ProjectCard v-for="project in visible" :key="project.id" :project="project" />
      </div>
    </div>
  </section>
</template>
