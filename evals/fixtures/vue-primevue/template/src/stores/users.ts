import { defineStore } from 'pinia'
import { fetchUsers } from '@/services/api'
import type { User, UserRole } from '@/types'

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
    loading: false,
    loaded: false,
    error: null as string | null,
    search: '',
    roleFilter: null as UserRole | null,
  }),
  getters: {
    filteredUsers(state): User[] {
      let result = state.users
      if (state.search) {
        result = result.filter(
          (user) =>
            user.name.toLowerCase().includes(state.search.toLowerCase()) ||
            user.email.toLowerCase().includes(state.search.toLowerCase()),
        )
      }
      if (state.roleFilter) {
        result = result.filter((user) => user.role === state.roleFilter)
      }
      return result
    },
    byId(state) {
      return (id: string) => state.users.find((user) => user.id === id)
    },
    adminCount(state): number {
      return state.users.filter((user) => user.role === 'admin').length
    },
    editorCount(state): number {
      return state.users.filter((user) => user.role === 'editor').length
    },
    viewerCount(state): number {
      return state.users.filter((user) => user.role === 'viewer').length
    },
  },
  actions: {
    async load(force = false) {
      if (this.loaded && !force) return
      this.loading = true
      this.error = null
      try {
        this.users = await fetchUsers()
        this.loaded = true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load users'
      } finally {
        this.loading = false
      }
    },
    setSearch(value: string) {
      this.search = value
    },
    setRoleFilter(role: UserRole | null) {
      this.roleFilter = role
    },
  },
})
