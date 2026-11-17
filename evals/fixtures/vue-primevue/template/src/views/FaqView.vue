<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchFaq } from '@/services/api'
import type { FaqItem } from '@/types'

const items = ref<FaqItem[]>([])
const open = ref<Record<string, boolean>>({})

function toggle(id: string) {
  open.value[id] = !open.value[id]
}

onMounted(async () => {
  items.value = await fetchFaq()
})
</script>

<template>
  <section class="flex max-w-3xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Help &amp; FAQ</h1>
    <div class="flex flex-col gap-3">
      <div v-for="item in items" :key="item.id" class="rounded-xl border border-surface-200 bg-surface-0">
        <div class="flex cursor-pointer items-center justify-between p-4 font-medium" @click="toggle(item.id)">
          {{ item.question }}
          <i class="pi" :class="open[item.id] ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
        </div>
        <div v-if="open[item.id]" class="border-t border-surface-200 p-4 text-surface-600">{{ item.answer }}</div>
      </div>
    </div>
  </section>
</template>
