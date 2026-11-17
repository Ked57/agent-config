// @vitest-environment jsdom
// L2: "Split [the settings page] into tabs: Profile, Preferences, Notifications and API. Saving should
// still save everything."
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { isShown, mountApp, sleep, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

const SECTIONS = ['Profile', 'Preferences', 'Notifications', 'API']

async function openSettings(saveSpy?: ReturnType<typeof vi.fn>) {
  await mountApp('/settings', saveSpy ? { api: (actual) => ({ saveSettings: saveSpy.mockImplementation(actual.saveSettings) }) } : {})
  await waitFor(() => expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('Ada Lovelace'))
}

const tab = (name: string) => screen.getAllByRole('tab').find((element) => text(element).toLowerCase() === name.toLowerCase())

const shownControl = (label: RegExp) => screen.queryAllByLabelText(label).find((element) => isShown(element))

/** A visible field label (PrimeVue Select's focus target is a span, which getByLabelText cannot reach). */
const shownLabel = (label: RegExp) => [...document.querySelectorAll('label')].find((element) => label.test(text(element)) && isShown(element))

describe('L2 settings split into tabs', () => {
  it('has a tab for each of Profile, Preferences, Notifications and API', async () => {
    await openSettings()
    for (const name of SECTIONS) expect(tab(name), `tab "${name}"`).toBeTruthy()
  })

  it('selecting a tab marks it selected and shows its section', async () => {
    await openSettings()
    await userEvent.click(tab('Notifications') as HTMLElement)
    await waitFor(() => expect(tab('Notifications')?.getAttribute('aria-selected')).toBe('true'))
    await waitFor(() => expect(shownControl(/email notifications/i)).toBeTruthy())
    expect(shownControl(/display name/i), 'Profile fields are hidden while Notifications is selected').toBeFalsy()

    await userEvent.click(tab('API') as HTMLElement)
    await waitFor(() => expect(shownControl(/api key/i)).toBeTruthy())
    expect(shownControl(/email notifications/i)).toBeFalsy()
    expect(tab('Notifications')?.getAttribute('aria-selected')).not.toBe('true')
  })

  it('the Preferences tab holds language and timezone', async () => {
    await openSettings()
    await userEvent.click(tab('Preferences') as HTMLElement)
    await waitFor(() => expect(shownLabel(/language/i)).toBeTruthy())
    expect(shownLabel(/time ?zone/i)).toBeTruthy()
    expect(shownLabel(/api key/i)).toBeFalsy()
  })

  it('saving from another tab still saves edits made on the Profile tab', async () => {
    const save = vi.fn()
    await openSettings(save)
    const name = screen.getByLabelText(/display name/i)
    await userEvent.clear(name)
    await userEvent.type(name, 'Ada King')

    await userEvent.click(tab('Notifications') as HTMLElement)
    const digest = await waitFor(() => shownControl(/weekly digest/i))
    // A person takes a moment between tabs; anything that resets the form on a tab switch shows up here.
    await sleep(800)
    await userEvent.click(digest)
    await sleep(300)

    const saveButton = screen.getAllByRole('button', { name: /save/i }).find((button) => isShown(button))
    expect(saveButton, 'a visible Save button on the Notifications tab').toBeTruthy()
    await userEvent.click(saveButton as HTMLElement)
    await waitFor(() => expect(save).toHaveBeenCalled())
    const saved = save.mock.calls.at(-1)?.[0]
    expect(saved).toMatchObject({ displayName: 'Ada King', weeklyDigest: true, email: 'ada@acme.test', timezone: 'Europe/London', language: 'en', emailNotifications: true })
  })
})
