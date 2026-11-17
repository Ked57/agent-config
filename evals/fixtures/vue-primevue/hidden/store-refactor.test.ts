// @vitest-environment jsdom
// N2: "Refactor the users Pinia store into a setup store (composition API style) and replace the three
// separate role count getters with a single countsByRole. Keep behaviour the same and update anything
// that uses it." Tested through the store's public API; the last three cases are behaviour the
// untouched store already has and must keep.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountApp, text, unmountApp, waitFor } from './harness'

type Api = typeof import('../services/api')
type UsersModule = typeof import('../stores/users')
type Store = ReturnType<UsersModule['useUsersStore']> & Record<string, unknown>

let fetchUsers: ReturnType<typeof vi.fn>

async function freshStore(): Promise<Store> {
  vi.resetModules()
  fetchUsers = vi.fn()
  vi.doMock('../services/api', async (importOriginal) => {
    const actual = await importOriginal<Api>()
    return { ...actual, fetchUsers: fetchUsers.mockImplementation(actual.fetchUsers) }
  })
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const { useUsersStore } = (await import('../stores/users')) as UsersModule
  return useUsersStore() as Store
}

beforeEach(() => vi.doUnmock('../services/api'))
afterEach(unmountApp)

/** Count for a role from a record or a Map; a role with no users may be 0 or absent. */
function count(counts: unknown, role: string): number {
  const value = counts instanceof Map ? counts.get(role) : (counts as Record<string, unknown> | undefined)?.[role]
  return value === undefined ? 0 : Number(value)
}

const counts = (store: Store) => ({ admin: count(store.countsByRole, 'admin'), editor: count(store.countsByRole, 'editor'), viewer: count(store.countsByRole, 'viewer') })

describe('N2 users store refactor', () => {
  it('countsByRole counts the loaded users per role', async () => {
    const store = await freshStore()
    await store.load()
    expect(store.countsByRole, 'the store exposes countsByRole').toBeTruthy()
    expect(counts(store)).toEqual({ admin: 1, editor: 2, viewer: 2 })
  })

  it('countsByRole updates when users are added or removed', async () => {
    const store = await freshStore()
    await store.load()
    const users = store.users as { id: string; role: string }[]
    const template = { ...(users[0] as object) }
    store.$patch((state: { users: { id: string; role: string }[] }) => {
      state.users = state.users.filter((user) => user.role !== 'admin')
    })
    expect(counts(store)).toEqual({ admin: 0, editor: 2, viewer: 2 })
    store.$patch((state: { users: { id: string; role: string }[] }) => {
      state.users.push({ ...(template as { id: string; role: string }), id: 'u9', role: 'viewer' })
    })
    expect(counts(store)).toEqual({ admin: 0, editor: 2, viewer: 3 })
  })

  it('the three per-role count getters are gone', async () => {
    const store = await freshStore()
    await store.load()
    for (const old of ['adminCount', 'editorCount', 'viewerCount']) expect(store[old], old).toBeUndefined()
  })

  it('search and role filter still narrow filteredUsers as before', async () => {
    const store = await freshStore()
    await store.load()
    const ids = () => (store.filteredUsers as { id: string }[]).map((user) => user.id)
    expect(ids()).toEqual(['u1', 'u2', 'u3', 'u4', 'u5'])
    store.setSearch('GRACE')
    expect(ids()).toEqual(['u2'])
    store.setSearch('acme.test')
    expect(ids()).toHaveLength(5)
    store.setRoleFilter('editor')
    expect(ids()).toEqual(['u2', 'u4'])
    store.setSearch('')
    store.setRoleFilter(null)
    expect(ids()).toHaveLength(5)
    expect((store.byId('u3') as { name: string } | undefined)?.name).toBe('Alan Turing')
    expect(store.byId('nope')).toBeUndefined()
  })

  it('load caches, reloads when forced, and records errors as before', async () => {
    const store = await freshStore()
    expect(store.loaded).toBe(false)
    const pending = store.load()
    expect(store.loading).toBe(true)
    await pending
    expect(store.loading).toBe(false)
    expect(store.loaded).toBe(true)
    await store.load()
    expect(fetchUsers).toHaveBeenCalledTimes(1)
    fetchUsers.mockImplementationOnce(async () => {
      throw new Error('offline')
    })
    await store.load(true)
    expect(fetchUsers).toHaveBeenCalledTimes(2)
    expect(store.error).toBe('offline')
    expect(store.loading).toBe(false)
  })

  it('the users list still renders every user', async () => {
    await mountApp('/users')
    await waitFor(() => expect(['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Linus Torvalds'].every((name) => text(document.body).includes(name))).toBe(true))
  })
})
