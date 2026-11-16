// @vitest-environment jsdom
// C3: "Navigating between pages feels abrupt. Add a subtle animated transition when moving between pages
// in the app." jsdom renders no animation, so the test checks that a navigation starts one: Vue
// <Transition> enter/leave classes on the page, a View Transition (document.startViewTransition), or a
// Web Animations call. Whether it is subtle, and the CSS that animates it, stay with the static checks
// and the judge.
import { afterEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { env, mountApp, text, unmountApp, waitFor, type MountedApp } from './harness'

afterEach(unmountApp)

const TRANSITION_CLASS = /(^|-)(enter|leave)(-from|-active|-to)?$|^animate-/

/** Records class names that appear anywhere in the body while `action` runs. */
async function classesDuring(action: () => Promise<void>) {
  const seen = new Set<string>()
  const record = (element: Element) => element.classList?.forEach((name) => seen.add(name))
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') record(mutation.target as Element)
      for (const node of mutation.addedNodes) if (node instanceof Element) [node, ...node.querySelectorAll('*')].forEach(record)
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
  const before = new Set<string>()
  document.body.querySelectorAll('*').forEach((element) => element.classList.forEach((name) => before.add(name)))
  await action()
  await new Promise((resolve) => setTimeout(resolve, 50))
  observer.disconnect()
  return [...seen].filter((name) => !before.has(name))
}

const heading = () => text(document.querySelector('main h1') ?? document.querySelector('h1'))

async function navigate(name: RegExp) {
  const nav = screen.getByRole('navigation')
  await userEvent.click(within(nav).getByRole('link', { name }))
}

let mounted: MountedApp

describe('C3 page transition', () => {
  it('navigating through the header still renders each page', async () => {
    mounted = await mountApp('/')
    await waitFor(() => expect(heading()).toMatch(/dashboard/i))
    await navigate(/projects/i)
    await waitFor(() => expect(heading()).toMatch(/projects/i))
    await navigate(/users/i)
    await waitFor(() => expect(heading()).toMatch(/users/i))
    await navigate(/help/i)
    await waitFor(() => expect(heading()).toMatch(/help/i))
    expect(mounted.router.currentRoute.value.fullPath).toBe('/help')
  })

  it('moving to another page starts an animated transition', async () => {
    mounted = await mountApp('/')
    await waitFor(() => expect(heading()).toMatch(/dashboard/i))
    env.viewTransitions = 0
    env.animations = 0
    const added = await classesDuring(async () => {
      await navigate(/projects/i)
      await waitFor(() => expect(heading()).toMatch(/projects/i))
    })
    const vueTransition = added.filter((name) => TRANSITION_CLASS.test(name))
    expect(vueTransition.length > 0 || env.viewTransitions > 0 || env.animations > 0, `transition classes seen: ${added.join(' ')}`).toBe(true)
  })

  it('quick successive navigations end on the last page', async () => {
    mounted = await mountApp('/')
    await waitFor(() => expect(heading()).toMatch(/dashboard/i))
    void mounted.router.push('/projects')
    void mounted.router.push('/settings')
    await mounted.router.push('/help')
    await waitFor(() => expect(heading()).toMatch(/help/i))
    expect(document.querySelectorAll('main h1').length).toBe(1)
  })
})
