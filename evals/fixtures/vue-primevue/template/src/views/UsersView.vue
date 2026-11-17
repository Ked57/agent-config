<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUsersStore } from '@/stores/users'

const usersStore = useUsersStore()
const { filteredUsers, loading, search } = storeToRefs(usersStore)

onMounted(() => {
  void usersStore.load()
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">Users</h1>
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search users" aria-label="Search users" />
      </IconField>
    </div>
    <p v-if="loading" class="text-surface-500">Loading…</p>
    <ul v-else class="divide-y divide-surface-200 rounded-xl border border-surface-200 bg-surface-0">
      <li v-for="user in filteredUsers" :key="user.id" class="flex items-center gap-4 p-4">
        <UserAvatar :user="user" size="large" />
        <div class="flex-1">
          <RouterLink :to="{ name: 'user', params: { id: user.id } }" class="font-medium hover:underline">{{ user.name }}</RouterLink>
          <p class="text-sm text-surface-500">{{ user.title }}</p>
        </div>
        <Tag :value="user.role" severity="secondary" />
      </li>
    </ul>
  </section>
</template>
