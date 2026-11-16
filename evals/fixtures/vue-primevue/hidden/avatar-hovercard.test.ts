// @vitest-environment jsdom
// C1: "On the users list, hovering or focusing a user's avatar should show a small card with their name,
// title, location, email and when they were last active. It should also work for keyboard users."
import { afterEach, describe, expect, it } from 'vitest'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { isShown, mountApp, sleep, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

// Ada (u1) appears in the list with name and title only; location and email are card-only fields.
const ADA = { name: 'Ada Lovelace', title: 'Head of Platform', location: 'London', email: 'ada@acme.test' }

const adaRow = () => [...document.querySelectorAll('li')].find((item) => text(item).includes(ADA.name) && item.querySelector('img'))

/** The avatar image in Ada's row (the trigger may wrap it). */
const adaAvatar = () => {
  const image = [...(adaRow()?.querySelectorAll('img') ?? [])].find((img) => /avatar-1\./.test(img.getAttribute('src') ?? ''))
  expect(image, "Ada's avatar image in the users list").toBeTruthy()
  return image as HTMLElement
}

/** The smallest visible element that shows Ada's card-only fields. */
function shownCard(): HTMLElement | null {
  const candidates = [...document.body.querySelectorAll<HTMLElement>('*')].filter(
    (element) => isShown(element) && text(element).includes(ADA.email) && text(element).includes(ADA.location),
  )
  return candidates.find((element) => !candidates.some((other) => other !== element && element.contains(other))) ?? null
}

function expectCardFields(card: HTMLElement) {
  const content = text(card)
  for (const field of [ADA.name, ADA.title, ADA.location, ADA.email]) expect(content, `card shows ${field}`).toContain(field)
  const hasLastActive = /active|seen|online/i.test(content) || card.querySelector('time') !== null
  expect(hasLastActive, 'card shows when the user was last active').toBe(true)
}

async function openUsers() {
  await mountApp('/users')
  await waitFor(() => expect(adaRow()).toBeTruthy())
  expect(shownCard(), 'no card before any interaction').toBeNull()
}

/** Tabs forward until focus lands on the avatar trigger in Ada's row (not the name link). */
async function tabToAdaAvatar() {
  const avatar = adaAvatar()
  for (let step = 0; step < 40; step += 1) {
    await userEvent.tab()
    const focused = document.activeElement as HTMLElement | null
    if (focused && focused !== document.body && (focused.contains(avatar) || avatar.contains(focused))) return focused
  }
  throw new Error("Tab never reached Ada's avatar")
}

describe('C1 avatar hovercard on the users list', () => {
  it('hovering the avatar shows a card with name, title, location, email and last active', async () => {
    await openUsers()
    await userEvent.hover(adaAvatar())
    const card = await waitFor(() => shownCard())
    expectCardFields(card)
  })

  it('moving the pointer away hides the card again', async () => {
    await openUsers()
    await userEvent.hover(adaAvatar())
    await waitFor(() => shownCard())
    await userEvent.unhover(adaAvatar())
    await userEvent.hover(document.querySelector('h1') as HTMLElement)
    await waitFor(() => shownCard() === null || null)
  })

  it('the avatar can be reached with Tab and focusing it shows the card', async () => {
    await openUsers()
    await tabToAdaAvatar()
    const card = await waitFor(() => shownCard())
    expectCardFields(card)
  })

  it('moving keyboard focus away hides the card', async () => {
    await openUsers()
    await tabToAdaAvatar()
    await waitFor(() => shownCard())
    const outside = within(adaRow() as HTMLElement).queryByRole('link', { name: ADA.name }) ?? (document.querySelector('input') as HTMLElement)
    // Move focus somewhere that is not the trigger or the card.
    outside.focus()
    if (shownCard()) await userEvent.tab()
    await waitFor(() => shownCard() === null || null)
  })

  it('Escape dismisses the card shown on focus', async () => {
    await openUsers()
    await tabToAdaAvatar()
    await waitFor(() => shownCard())
    await userEvent.keyboard('{Escape}')
    await sleep(400)
    expect(shownCard()).toBeNull()
  })
})
