<script setup lang="ts">
import Avatar from 'primevue/avatar'
import { initials } from '@/utils/format'
import type { User } from '@/types'

defineProps<{ user: User; size?: 'normal' | 'large' | 'xlarge' }>()
</script>

<template>
  <Avatar :image="user.avatarUrl" :label="user.avatarUrl ? undefined : initials(user.name)" :size="size ?? 'normal'" shape="circle" />
</template>
