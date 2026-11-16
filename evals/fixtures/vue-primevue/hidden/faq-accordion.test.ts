// @vitest-environment jsdom
// C2: "Make the FAQ on the Help page behave like a proper accordion: only one answer can be open at a
// time, and it should work with the keyboard and screen readers."
import { afterEach, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { isShown, mountApp, shownText, sleep, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

const { fetchFaq } = await import('../services/api')
const FAQ = await fetchFaq()
const [FIRST, SECOND, THIRD] = FAQ as [(typeof FAQ)[number], (typeof FAQ)[number], (typeof FAQ)[number]]

/** The interactive header for a question: a button, summary or role=button holding its text. */
function header(question: string): HTMLElement {
  const holders = [...document.body.querySelectorAll<HTMLElement>('*')].filter((element) => text(element) === question)
  for (const holder of holders) {
    const control = holder.closest<HTMLElement>('button, summary, [role="button"]') ?? holder.querySelector<HTMLElement>('button, summary, [role="button"]')
    if (control) return control
  }
  throw new Error(`no button or summary for "${question}"`)
}

const answerShown = (answer: string) => shownText(document.querySelector('main') ?? document.body).includes(answer)

async function openHelp() {
  await mountApp('/help')
  await waitFor(() => expect(text(document.body)).toContain(FIRST.question))
  await sleep(50)
}

/** Tabs forward until `control` has focus. */
async function tabTo(control: HTMLElement) {
  for (let step = 0; step < 40; step += 1) {
    await userEvent.tab()
    if (document.activeElement === control) return
  }
  throw new Error(`Tab never reached "${text(control)}"`)
}

/** aria-expanded on a button, or the open state of a native <details> around a <summary>. */
function expandedState(control: HTMLElement) {
  if (control.tagName === 'SUMMARY') return String((control.parentElement as HTMLDetailsElement | null)?.open ?? false)
  return control.getAttribute('aria-expanded')
}

describe('C2 FAQ accordion', () => {
  it('clicking a question shows its answer', async () => {
    await openHelp()
    await userEvent.click(header(FIRST.question))
    await waitFor(() => expect(answerShown(FIRST.answer)).toBe(true))
  })

  it('opening a second question closes the first', async () => {
    await openHelp()
    await userEvent.click(header(FIRST.question))
    await waitFor(() => expect(answerShown(FIRST.answer)).toBe(true))
    await userEvent.click(header(SECOND.question))
    await waitFor(() => expect(answerShown(SECOND.answer)).toBe(true))
    await waitFor(() => expect(answerShown(FIRST.answer), 'the first answer closed').toBe(false))
    await userEvent.click(header(THIRD.question))
    await waitFor(() => expect(answerShown(THIRD.answer)).toBe(true))
    await waitFor(() => expect([FAQ.filter((item) => answerShown(item.answer)).length]).toEqual([1]))
  })

  it('questions are reachable with Tab and open with Enter and Space', async () => {
    await openHelp()
    const first = header(FIRST.question)
    await tabTo(first)
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(answerShown(FIRST.answer)).toBe(true))
    const second = header(SECOND.question)
    second.focus()
    await userEvent.keyboard(' ')
    await waitFor(() => expect(answerShown(SECOND.answer)).toBe(true))
    await waitFor(() => expect(answerShown(FIRST.answer)).toBe(false))
  })

  it('each question exposes its expanded state to assistive technology', async () => {
    await openHelp()
    const first = header(FIRST.question)
    const second = header(SECOND.question)
    expect(expandedState(first)).toBe('false')
    await userEvent.click(first)
    await waitFor(() => expect(expandedState(header(FIRST.question))).toBe('true'))
    await userEvent.click(second)
    await waitFor(() => expect(expandedState(header(SECOND.question))).toBe('true'))
    await waitFor(() => expect(expandedState(header(FIRST.question))).toBe('false'))
  })

  it('the question points at its answer panel (aria-controls or a native details)', async () => {
    await openHelp()
    const first = header(FIRST.question)
    await userEvent.click(first)
    await waitFor(() => expect(answerShown(FIRST.answer)).toBe(true))
    const controls = first.getAttribute('aria-controls')
    const panel = controls ? document.getElementById(controls) : first.closest('details')
    expect(panel, 'aria-controls points at the answer panel (or a native <details> holds it)').toBeTruthy()
    expect(text(panel)).toContain(FIRST.answer)
    expect(isShown(panel)).toBe(true)
  })
})
