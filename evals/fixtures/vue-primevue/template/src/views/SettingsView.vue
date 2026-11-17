<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { fetchSettings, saveSettings } from '@/services/api'
import type { Settings } from '@/types'

const form = reactive<Settings>({
  displayName: '',
  email: '',
  timezone: '',
  language: 'en',
  emailNotifications: false,
  weeklyDigest: false,
  apiKey: '',
})
const saving = ref(false)

const languages = [
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
]
const timezones = ['Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo']

async function onSubmit() {
  saving.value = true
  try {
    Object.assign(form, await saveSettings({ ...form }))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  Object.assign(form, await fetchSettings())
})
</script>

<template>
  <section class="flex max-w-2xl flex-col gap-6">
    <h1 class="text-2xl font-semibold">Settings</h1>
    <form class="flex flex-col gap-8 rounded-xl border border-surface-200 bg-surface-0 p-6" @submit.prevent="onSubmit">
      <fieldset class="flex flex-col gap-4">
        <legend class="mb-2 text-lg font-semibold">Profile</legend>
        <div class="flex flex-col gap-2">
          <label for="displayName" class="text-sm font-medium">Display name</label>
          <InputText id="displayName" v-model="form.displayName" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="email" class="text-sm font-medium">Email</label>
          <InputText id="email" v-model="form.email" type="email" />
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-4">
        <legend class="mb-2 text-lg font-semibold">Preferences</legend>
        <div class="flex flex-col gap-2">
          <label for="language" class="text-sm font-medium">Language</label>
          <Select v-model="form.language" input-id="language" :options="languages" option-label="label" option-value="value" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="timezone" class="text-sm font-medium">Timezone</label>
          <Select v-model="form.timezone" input-id="timezone" :options="timezones" />
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-4">
        <legend class="mb-2 text-lg font-semibold">Notifications</legend>
        <div class="flex items-center justify-between">
          <label for="emailNotifications" class="text-sm">Email notifications</label>
          <ToggleSwitch v-model="form.emailNotifications" input-id="emailNotifications" />
        </div>
        <div class="flex items-center justify-between">
          <label for="weeklyDigest" class="text-sm">Weekly digest</label>
          <ToggleSwitch v-model="form.weeklyDigest" input-id="weeklyDigest" />
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-4">
        <legend class="mb-2 text-lg font-semibold">API</legend>
        <div class="flex flex-col gap-2">
          <label for="apiKey" class="text-sm font-medium">API key</label>
          <InputText id="apiKey" :model-value="form.apiKey" readonly class="font-mono" />
        </div>
      </fieldset>

      <div class="flex justify-end">
        <Button type="submit" label="Save changes" :loading="saving" />
      </div>
    </form>
  </section>
</template>
