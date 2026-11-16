// @vitest-environment jsdom
// C4: "Make the top header shrink once the user scrolls down (less padding, smaller logo and title), and
// go back to full size when they scroll back to the top."
// jsdom has no layout, so the test observes the header's state (classes, inline styles and data-/aria-
// attributes of the header and its descendants) after a scroll event and an IntersectionObserver
// callback. Whether that state really means less padding and a smaller logo is left to the static checks
// and the judge; a CSS-only scroll-driven animation is not observable here.
import { afterEach, describe, expect, it } from 'vitest'
import { mountApp, scrollPageTo, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

const header = () => (document.querySelector('header') ?? document.querySelector('[role="banner"]')) as HTMLElement | null

/** A fingerprint of everything in the header that a shrink could toggle. */
function headerState() {
  const root = header()
  if (!root) return ''
  return [root, ...root.querySelectorAll('*')]
    .map((element) => {
      const attributes = [...element.attributes].filter((attribute) => /^(class|style|data-|aria-expanded)/.test(attribute.name))
      return `${element.tagName}[${attributes.map((attribute) => `${attribute.name}=${attribute.value}`).join(' ')}]`
    })
    .join('\n')
}

async function openPage() {
  await mountApp('/')
  await waitFor(() => header())
  await scrollPageTo(0)
}

describe('C4 shrinking header', () => {
  it('the header changes state after the page scrolls down', async () => {
    await openPage()
    const top = headerState()
    await scrollPageTo(400)
    await waitFor(() => expect(headerState()).not.toBe(top))
  })

  it('the header goes back to its full-size state at the top', async () => {
    await openPage()
    const top = headerState()
    await scrollPageTo(400)
    await waitFor(() => expect(headerState()).not.toBe(top))
    await scrollPageTo(0)
    await waitFor(() => expect(headerState()).toBe(top))
  })

  it('the header stays compact while scrolling further down', async () => {
    await openPage()
    const top = headerState()
    await scrollPageTo(400)
    await waitFor(() => expect(headerState()).not.toBe(top))
    const compact = headerState()
    await scrollPageTo(900)
    expect(headerState()).toBe(compact)
  })
})
