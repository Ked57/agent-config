// @vitest-environment jsdom
// F1: "display name is required and must be 2 to 50 characters, and the email must be valid. Show
// errors inline next to the fields in an accessible way, and don't submit while the form is invalid."
// Errors may appear on blur or on submit, so each case types, tabs away, then clicks Save.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { isShown, mountApp, sleep, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

let save: ReturnType<typeof vi.fn>

async function openSettings() {
  save = vi.fn()
  await mountApp('/settings', { api: (actual) => ({ saveSettings: save.mockImplementation(actual.saveSettings) }) })
  await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Ada Lovelace'))
}

const nameInput = () => screen.getByLabelText(/display name/i) as HTMLInputElement
const emailInput = () => screen.getAllByLabelText(/^\s*e-?mail\b/i).find((element) => element instanceof HTMLInputElement) as HTMLInputElement

async function setValue(input: HTMLInputElement, value: string) {
  await userEvent.clear(input)
  if (value) await userEvent.type(input, value)
  await userEvent.tab()
}

const submit = async () => userEvent.click(screen.getByRole('button', { name: /save/i }))

/** Text of the visible elements the field points at through aria-errormessage / aria-describedby. */
function associatedText(input: HTMLElement) {
  const ids = `${input.getAttribute('aria-errormessage') ?? ''} ${input.getAttribute('aria-describedby') ?? ''}`.split(/\s+/).filter(Boolean)
  return ids
    .map((id) => document.getElementById(id))
    .filter((element) => element && isShown(element))
    .map((element) => text(element))
    .join(' ')
}

async function expectFieldError(input: HTMLInputElement) {
  await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
  await waitFor(() => expect(associatedText(input), 'error text linked with aria-describedby or aria-errormessage').toMatch(/\w{3,}/))
}

async function expectNotSaved() {
  await sleep(800)
  expect(save, 'saveSettings must not be called while the form is invalid').not.toHaveBeenCalled()
}

describe('F1 inline validation of the settings form', () => {
  it('an empty display name shows a linked error and blocks the save', async () => {
    await openSettings()
    await setValue(nameInput(), '')
    await submit()
    await expectFieldError(nameInput())
    await expectNotSaved()
  })

  it('a one-character display name shows a linked error and blocks the save', async () => {
    await openSettings()
    await setValue(nameInput(), 'A')
    await submit()
    await expectFieldError(nameInput())
    await expectNotSaved()
  })

  it('a display name over 50 characters is rejected or cannot be entered', async () => {
    await openSettings()
    await setValue(nameInput(), 'x'.repeat(51))
    await submit()
    if (nameInput().value.length > 50) {
      await expectFieldError(nameInput())
      await expectNotSaved()
    } else {
      await waitFor(() => expect(save).toHaveBeenCalled())
      expect(save.mock.calls.at(-1)?.[0].displayName.length).toBeLessThanOrEqual(50)
    }
  })

  it('an invalid email shows a linked error and blocks the save', async () => {
    await openSettings()
    for (const bad of ['not-an-email', 'ada@']) {
      await setValue(emailInput(), bad)
      await submit()
      await expectFieldError(emailInput())
    }
    await expectNotSaved()
  })

  it('valid values at the length limits are saved and show no error', async () => {
    await openSettings()
    await setValue(nameInput(), 'Al')
    await setValue(emailInput(), 'al@acme.test')
    await submit()
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0]).toMatchObject({ displayName: 'Al', email: 'al@acme.test' })
    expect(nameInput().getAttribute('aria-invalid')).not.toBe('true')
    expect(emailInput().getAttribute('aria-invalid')).not.toBe('true')
    // Let the first save finish so the button is enabled again.
    await save.mock.results[0]?.value
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i }).hasAttribute('disabled')).toBe(false))
    await sleep(100)

    await setValue(nameInput(), 'y'.repeat(50))
    await submit()
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1]?.[0].displayName).toBe('y'.repeat(50))
  })

  it('fixing the error lets the form submit', async () => {
    await openSettings()
    await setValue(emailInput(), 'nope')
    await submit()
    await expectFieldError(emailInput())
    await setValue(emailInput(), 'ada@acme.test')
    await submit()
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(emailInput().getAttribute('aria-invalid')).not.toBe('true'))
  })
})
