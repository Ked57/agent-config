<script setup lang="ts">
const links = [
  { to: '/', label: 'Dashboard', icon: 'pi pi-chart-bar' },
  { to: '/projects', label: 'Projects', icon: 'pi pi-briefcase' },
  { to: '/users', label: 'Users', icon: 'pi pi-users' },
  { to: '/gallery', label: 'Gallery', icon: 'pi pi-images' },
  { to: '/settings', label: 'Settings', icon: 'pi pi-cog' },
  { to: '/help', label: 'Help', icon: 'pi pi-question-circle' },
]
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-surface-200 bg-surface-0">
    <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-5">
      <RouterLink to="/" class="flex items-center gap-2 text-xl font-semibold text-surface-900">
        <span class="inline-block size-8 rounded-md bg-primary"></span>
        Acme Console
      </RouterLink>
      <nav aria-label="Main" class="flex flex-1 flex-wrap gap-1">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-surface-600 hover:bg-surface-100"
          active-class="bg-surface-100 text-surface-900 font-medium"
        >
          <i :class="link.icon" aria-hidden="true"></i>
          {{ link.label }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
