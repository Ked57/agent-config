// @vitest-environment jsdom
// L4: "When I click Save changes on the settings page there's no feedback at all. Show a short
// confirmation toast when the save succeeds and an error one if it fails."
// The failure path rejects saveSettings in src/services/api.ts, the template's only save seam.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { mountApp, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

const SUCCESS = /saved|success|updated/i
const FAILURE = /error|fail|could ?n.?t|unable|not (been )?saved|went wrong|try again/i

/** Announced messages (toast items are role="alert" or role="status" live regions) with text. */
const messages = () =>
  [...document.body.querySelectorAll<HTMLElement>('[role="alert"], [role="status"], [aria-live]:not([aria-live="off"])')]
    .map((element) => text(element))
    .filter(Boolean)

async function openSettings(options: Parameters<typeof mountApp>[1] = {}) {
  await mountApp('/settings', options)
  await waitFor(() => expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('Ada Lovelace'))
}

const clickSave = async () => userEvent.click(screen.getByRole('button', { name: /save changes/i }))

describe('L4 save feedback toast', () => {
  it('shows a confirmation toast after a successful save', async () => {
    await openSettings()
    expect(messages().filter((message) => SUCCESS.test(message))).toEqual([])
    await clickSave()
    await waitFor(() => expect(messages().some((message) => SUCCESS.test(message))).toBe(true))
    expect(messages().some((message) => /error|fail/i.test(message))).toBe(false)
  })

  it('the confirmation toast goes away on its own', async () => {
    await openSettings()
    await clickSave()
    await waitFor(() => expect(messages().some((message) => SUCCESS.test(message))).toBe(true))
    await waitFor(() => expect(messages().some((message) => SUCCESS.test(message))).toBe(false), 12000)
  }, 40000)

  it('shows an error toast when the save fails', async () => {
    const save = vi.fn(async () => {
      throw new Error('Network down')
    })
    await openSettings({ api: () => ({ saveSettings: save }) })
    await clickSave()
    await waitFor(() => expect(save).toHaveBeenCalled())
    await waitFor(() => expect(messages().some((message) => FAILURE.test(message))).toBe(true))
  })

  it('a failed save does not claim success', async () => {
    const save = vi.fn(async () => {
      throw new Error('Network down')
    })
    await openSettings({ api: () => ({ saveSettings: save }) })
    await clickSave()
    await waitFor(() => expect(messages().some((message) => FAILURE.test(message))).toBe(true))
    expect(messages().filter((message) => SUCCESS.test(message) && !FAILURE.test(message))).toEqual([])
  })
})
