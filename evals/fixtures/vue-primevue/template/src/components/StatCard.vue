<script setup lang="ts">
defineProps<{ label: string; value: string; icon: string }>()
</script>

<template>
  <div class="rounded-xl border border-surface-200 bg-surface-0 p-5">
    <div class="flex items-center justify-between text-sm text-surface-500">
      <span>{{ label }}</span>
      <i :class="icon" aria-hidden="true"></i>
    </div>
    <p class="mt-2 text-2xl font-semibold">{{ value }}</p>
  </div>
</template>
