// @vitest-environment jsdom
// C7: "Add a dark mode toggle in the header. It should default to the system setting, remember the
// user's choice, and switch both the PrimeVue components and our own Tailwind styles."
// "Dark" is read from the app's own PrimeVue darkModeSelector, so any class, attribute or
// <meta name="color-scheme"> mechanism counts as long as PrimeVue follows it. The Tailwind half is not
// observable in jsdom (no CSS is built); the task keeps a static check for the dark variant.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { env, isShown, mountApp, unmountApp, waitFor, type MountedApp } from './harness'

let mounted: MountedApp

beforeEach(() => {
  localStorage.clear()
  env.prefersDark = false
})
afterEach(unmountApp)

type Selector = string | false | undefined | string[]

/** Whether the page currently matches one of PrimeVue's dark-mode selector forms. */
function primeVueDark(): boolean {
  const config = (mounted.app.config.globalProperties.$primevue as { config?: { theme?: { options?: { darkModeSelector?: Selector } } } } | undefined)?.config
  const selector = config?.theme?.options?.darkModeSelector
  if (selector === false || selector === undefined || selector === 'none') return false
  if (selector === 'system') return env.prefersDark
  const roots = [document.documentElement, document.body]
  const matches = (css: string) => roots.some((root) => root.matches(css))
  return (Array.isArray(selector) ? selector : [selector]).some((entry) => {
    let rule = entry.trim()
    let needsSystemDark = false
    const media = /^@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{(.*)\}$/s.exec(rule)
    if (media) {
      needsSystemDark = true
      rule = (media[1] ?? '').trim()
    }
    rule = rule.replace(/\{\s*\[CSS\]\s*\}$/, '').trim()
    if (needsSystemDark && !env.prefersDark) return false
    try {
      return matches(rule)
    } catch {
      return false
    }
  })
}

const header = () => (document.querySelector('header') ?? document.querySelector('[role="banner"]')) as HTMLElement

function themeToggle(): HTMLElement {
  const scope = within(header())
  const name = /dark|light|theme|mode|appearance|colou?r scheme/i
  const toggle = [...scope.queryAllByRole('button', { name }), ...scope.queryAllByRole('switch', { name }), ...scope.queryAllByRole('checkbox', { name })].find((element) => isShown(element))
  expect(toggle, 'a button or switch in the header named for dark/light mode').toBeTruthy()
  return toggle as HTMLElement
}

async function open() {
  mounted = await mountApp('/')
  await waitFor(() => header())
}

describe('C7 dark mode toggle', () => {
  it('the header toggle switches PrimeVue dark mode on and off', async () => {
    await open()
    expect(primeVueDark()).toBe(false)
    await userEvent.click(themeToggle())
    await waitFor(() => expect(primeVueDark()).toBe(true))
    await userEvent.click(themeToggle())
    await waitFor(() => expect(primeVueDark()).toBe(false))
  })

  it('starts dark when the system prefers dark and nothing is stored', async () => {
    env.prefersDark = true
    await open()
    await waitFor(() => expect(primeVueDark()).toBe(true))
  })

  it('starts light when the system prefers light and nothing is stored', async () => {
    env.prefersDark = false
    await open()
    await waitFor(() => expect(themeToggle()).toBeTruthy())
    expect(primeVueDark()).toBe(false)
  })

  it('remembers choosing dark on a light system after a reload', async () => {
    await open()
    await userEvent.click(themeToggle())
    await waitFor(() => expect(primeVueDark()).toBe(true))
    unmountApp()
    await open()
    await waitFor(() => expect(primeVueDark()).toBe(true))
  })

  it('remembers choosing light on a dark system after a reload', async () => {
    env.prefersDark = true
    await open()
    await waitFor(() => expect(primeVueDark()).toBe(true))
    await userEvent.click(themeToggle())
    await waitFor(() => expect(primeVueDark()).toBe(false))
    unmountApp()
    await open()
    await waitFor(() => expect(themeToggle()).toBeTruthy())
    expect(primeVueDark()).toBe(false)
  })
})
