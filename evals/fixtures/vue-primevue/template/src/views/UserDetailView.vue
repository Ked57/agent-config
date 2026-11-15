<script setup lang="ts">
import { computed, onMounted } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUsersStore } from '@/stores/users'
import { formatDate } from '@/utils/format'

const props = defineProps<{ id: string }>()
const usersStore = useUsersStore()
const user = computed(() => usersStore.byId(props.id))

onMounted(() => {
  void usersStore.load()
})
</script>

<template>
  <section v-if="user" class="flex flex-col gap-6">
    <RouterLink to="/users" class="text-sm text-primary hover:underline">← All users</RouterLink>
    <div class="flex items-center gap-4">
      <UserAvatar :user="user" size="xlarge" />
      <div>
        <h1 class="text-2xl font-semibold">{{ user.name }}</h1>
        <p class="text-surface-500">{{ user.title }} · {{ user.location }}</p>
      </div>
    </div>
    <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 rounded-xl border border-surface-200 bg-surface-0 p-6">
      <dt class="text-surface-500">Email</dt>
      <dd>{{ user.email }}</dd>
      <dt class="text-surface-500">Role</dt>
      <dd class="capitalize">{{ user.role }}</dd>
      <dt class="text-surface-500">Last active</dt>
      <dd>{{ formatDate(user.lastActiveAt) }}</dd>
      <dt class="text-surface-500">Bio</dt>
      <dd>{{ user.bio }}</dd>
    </dl>
  </section>
  <p v-else class="text-surface-500">Loading…</p>
</template>
