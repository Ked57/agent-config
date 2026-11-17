// @vitest-environment jsdom
// L1: "clicking the trash icon on an order deletes it immediately ... Make people confirm before an
// order is deleted." Exercised through the rendered dashboard with the real router, Pinia and PrimeVue.
import { afterEach, describe, expect, it } from 'vitest'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { mountApp, sleep, text, unmountApp, waitFor } from './harness'

const ORDER = 'ORD-1003'

afterEach(unmountApp)

const rowFor = (id: string) => [...document.querySelectorAll('tr')].find((row) => text(row).includes(id))

async function openDashboard() {
  await mountApp('/')
  await waitFor(() => expect(rowFor(ORDER)).toBeTruthy())
}

const trashButton = (id: string) => within(rowFor(id) as HTMLElement).getByRole('button', { name: new RegExp(`delete|remove|trash`, 'i') })

/** The confirmation UI: a dialog or alertdialog anywhere in the body (PrimeVue teleports overlays). */
const confirmation = () => {
  const dialogs = [...document.body.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], dialog[open]')]
  return dialogs.find((dialog) => within(dialog).queryAllByRole('button').length > 0) ?? null
}

const acceptButton = (dialog: HTMLElement) =>
  within(dialog).getAllByRole('button').find((button) => /delete|remove|confirm|yes|^ok$/i.test(text(button) || button.getAttribute('aria-label') || ''))

const rejectButton = (dialog: HTMLElement) =>
  within(dialog).getAllByRole('button').find((button) => /cancel|keep|^no\b|back|dismiss/i.test(text(button) || button.getAttribute('aria-label') || ''))

describe('L1 confirm before deleting an order', () => {
  it('clicking the trash icon does not delete the order on its own', async () => {
    await openDashboard()
    await userEvent.click(trashButton(ORDER))
    await sleep(800)
    expect(rowFor(ORDER), 'the order row is still there before any confirmation').toBeTruthy()
  })

  it('shows a confirmation with an accessible name that mentions deleting', async () => {
    await openDashboard()
    await userEvent.click(trashButton(ORDER))
    const dialog = await waitFor(() => confirmation())
    const labelledBy = dialog.getAttribute('aria-labelledby')
    const name = dialog.getAttribute('aria-label') ?? (labelledBy ? text(document.getElementById(labelledBy)) : '')
    expect(name, 'the dialog has an accessible name').not.toBe('')
    expect(text(dialog)).toMatch(/delete|remove/i)
  })

  it('cancelling keeps the order', async () => {
    await openDashboard()
    await userEvent.click(trashButton(ORDER))
    const dialog = await waitFor(() => confirmation())
    const reject = rejectButton(dialog)
    if (reject) await userEvent.click(reject)
    else await userEvent.keyboard('{Escape}')
    await waitFor(() => !confirmation())
    await sleep(800)
    expect(rowFor(ORDER)).toBeTruthy()
  })

  it('confirming deletes the order', async () => {
    await openDashboard()
    const rowsBefore = document.querySelectorAll('tbody tr').length
    await userEvent.click(trashButton(ORDER))
    const dialog = await waitFor(() => confirmation())
    const accept = acceptButton(dialog)
    expect(accept, 'the confirmation has a delete/confirm button').toBeTruthy()
    await userEvent.click(accept as HTMLElement)
    await waitFor(() => expect(rowFor(ORDER)).toBeFalsy())
    expect(document.querySelectorAll('tbody tr').length).toBe(rowsBefore - 1)
  })

  it('confirming one order leaves the other orders alone', async () => {
    await openDashboard()
    await userEvent.click(trashButton(ORDER))
    const dialog = await waitFor(() => confirmation())
    await userEvent.click(acceptButton(dialog) as HTMLElement)
    await waitFor(() => expect(rowFor(ORDER)).toBeFalsy())
    for (const other of ['ORD-1001', 'ORD-1002', 'ORD-1004']) expect(rowFor(other), other).toBeTruthy()
  })
})
