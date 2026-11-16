// @vitest-environment jsdom
// C6: "Add a copy-to-clipboard button next to the API key on the settings page and next to the email on
// the user detail page, with some feedback that it was copied."
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/dom'
import { env, isShown, mountApp, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

// fireEvent rather than user-event: user-event replaces navigator.clipboard with its own stub.
const click = async (element: HTMLElement) => {
  await fireEvent.click(element)
}

/** Everything a user could perceive as "copied": visible text, labels, titles and tooltips. */
const feedbackText = () =>
  [text(document.body), ...[...document.body.querySelectorAll('[aria-label], [title], [data-pd-tooltip]')].map((element) => `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`)].join(' ')

const copyButton = () => {
  const button = screen.queryAllByRole('button', { name: /copy/i }).find((element) => isShown(element))
  expect(button, 'a visible button whose accessible name mentions copying').toBeTruthy()
  return button as HTMLElement
}

async function openSettings() {
  await mountApp('/settings')
  const { fetchSettings } = await import('../services/api')
  const { apiKey } = await fetchSettings()
  await waitFor(() => expect(text(document.body) + [...document.querySelectorAll('input')].map((input) => input.value).join(' ')).toContain(apiKey))
  return apiKey
}

async function openUser() {
  await mountApp('/users/u1')
  await waitFor(() => expect(text(document.body)).toContain('ada@acme.test'))
}

describe('C6 copy-to-clipboard buttons', () => {
  it('the settings page copies the API key', async () => {
    const apiKey = await openSettings()
    await click(copyButton())
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    expect(env.clipboardWrites).toContain(apiKey)
  })

  it('the settings page shows that the API key was copied', async () => {
    await openSettings()
    expect(feedbackText()).not.toMatch(/copied/i)
    await click(copyButton())
    await waitFor(() => expect(feedbackText()).toMatch(/copied/i))
  })

  it('the user detail page copies the email', async () => {
    await openUser()
    await click(copyButton())
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled())
    expect(env.clipboardWrites).toEqual(['ada@acme.test'])
  })

  it('the user detail page shows that the email was copied', async () => {
    await openUser()
    expect(feedbackText()).not.toMatch(/copied/i)
    await click(copyButton())
    await waitFor(() => expect(feedbackText()).toMatch(/copied/i))
  })
})
