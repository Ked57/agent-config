<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchPhotos } from '@/services/api'
import type { Photo } from '@/types'

const photos = ref<Photo[]>([])

onMounted(async () => {
  photos.value = await fetchPhotos()
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="relative overflow-hidden rounded-xl">
      <img src="/images/hero.png" alt="Mountain lake at sunrise" loading="lazy" class="w-full" />
      <div class="absolute inset-x-0 bottom-0 bg-black/50 p-6 text-white">
        <h1 class="text-3xl font-semibold">Team gallery</h1>
        <p>Photos from this year's offsites.</p>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
      <figure v-for="photo in photos" :key="photo.id" class="overflow-hidden rounded-lg bg-surface-0">
        <img :src="photo.src" :alt="photo.title" />
        <figcaption class="p-3 text-sm">
          <span class="font-medium">{{ photo.title }}</span>
          <span class="text-surface-500"> · {{ photo.author }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>
