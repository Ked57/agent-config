// @vitest-environment jsdom
// L3: "On the dashboard orders table, let me sort by total and by created date, and filter the rows by
// status." Sorting is checked on the rendered row order; filtering through whatever status control the
// page offers (a select/combobox, native <select>, or buttons/radios labelled with a status).
import { afterEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { isShown, mountApp, sleep, text, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

const { fetchOrders } = await import('../services/api')
const ORDERS = await fetchOrders()
const PAID = ORDERS.filter((order) => order.status === 'paid').map((order) => order.id).sort()

/** The orders table: the one whose rows show order ids. */
const table = () => [...document.querySelectorAll('table')].find((element) => /ORD-\d+/.test(text(element))) as HTMLTableElement | undefined

const headers = () => [...(table()?.querySelectorAll('thead th') ?? [])] as HTMLElement[]
const columnIndex = (name: RegExp) => headers().findIndex((th) => name.test(text(th)))

const bodyRows = () => [...(table()?.querySelectorAll('tbody tr') ?? [])].filter((row) => /ORD-\d+/.test(text(row)) && isShown(row)) as HTMLTableRowElement[]
const rowIds = () => bodyRows().map((row) => /ORD-\d+/.exec(text(row))?.[0] ?? '')

const cellValues = (name: RegExp) => {
  const index = columnIndex(name)
  return bodyRows().map((row) => text(row.cells[index]))
}

const money = (value: string) => Number(value.replace(/[^\d.-]/g, ''))
const date = (value: string) => new Date(value).getTime()

const isSorted = (values: number[], direction: 'asc' | 'desc') => values.every((value, index) => index === 0 || (direction === 'asc' ? values[index - 1]! <= value : values[index - 1]! >= value))

async function openDashboard() {
  await mountApp('/')
  await waitFor(() => expect(rowIds()).toHaveLength(ORDERS.length))
}

async function clickHeader(name: RegExp) {
  const th = headers()[columnIndex(name)]
  expect(th, `a ${name} column header`).toBeTruthy()
  const control = (th as HTMLElement).querySelector<HTMLElement>('button, [role="button"]') ?? (th as HTMLElement)
  await userEvent.click(control)
  await sleep(50)
}

async function expectSortable(name: RegExp, parse: (value: string) => number) {
  await openDashboard()
  const before = cellValues(name).map(parse)
  expect(before.every((value) => Number.isFinite(value)), `${name} cells parse`).toBe(true)
  await clickHeader(name)
  await waitFor(() => expect(isSorted(cellValues(name).map(parse), 'asc')).toBe(true))
  await clickHeader(name)
  await waitFor(() => expect(isSorted(cellValues(name).map(parse), 'desc')).toBe(true))
  const after = cellValues(name).map(parse)
  expect(after[0]).toBeGreaterThan(after.at(-1) as number)
  expect(rowIds()).toHaveLength(ORDERS.length)
}

/** Picks "paid" in the page's status filter, whatever form it takes. */
async function filterByStatus(status: string) {
  const label = /status|filter/i
  const native = screen.queryAllByRole('combobox', { name: label }).find((element) => element instanceof HTMLSelectElement) as HTMLSelectElement | undefined
  if (native) {
    const option = [...native.options].find((item) => text(item).toLowerCase() === status || item.value === status)
    await userEvent.selectOptions(native, option as HTMLOptionElement)
    return
  }
  const combo = [...screen.queryAllByRole('combobox', { name: label }), ...screen.queryAllByRole('combobox')].find((element) => isShown(element))
  if (combo) {
    await userEvent.click(combo)
    const option = await waitFor(() => screen.queryAllByRole('option').find((item) => text(item).toLowerCase() === status))
    await userEvent.click(option)
    return
  }
  const scope = document.querySelector('main') ?? document.body
  const choice = [...within(scope as HTMLElement).queryAllByRole('radio'), ...within(scope as HTMLElement).queryAllByRole('button'), ...within(scope as HTMLElement).queryAllByRole('tab')].find(
    (element) => text(element).toLowerCase() === status || (element.getAttribute('aria-label') ?? '').toLowerCase() === status,
  )
  expect(choice, 'a status filter control').toBeTruthy()
  await userEvent.click(choice as HTMLElement)
}

describe('L3 orders table sort and filter', () => {
  it('clicking the Total header sorts rows by total, ascending then descending', async () => {
    await expectSortable(/^total$/i, money)
  })

  it('clicking the Created header sorts rows by created date, ascending then descending', async () => {
    await expectSortable(/^created/i, date)
  })

  it('filtering by status shows only the orders with that status', async () => {
    await openDashboard()
    await filterByStatus('paid')
    await waitFor(() => expect([...rowIds()].sort()).toEqual(PAID))
    const status = cellValues(/^status$/i)
    expect(status.every((value) => /paid/i.test(value))).toBe(true)
  })

  it('the status filter can be combined with sorting by total', async () => {
    await openDashboard()
    await filterByStatus('paid')
    await waitFor(() => expect([...rowIds()].sort()).toEqual(PAID))
    await clickHeader(/^total$/i)
    await clickHeader(/^total$/i)
    await waitFor(() => expect(isSorted(cellValues(/^total$/i).map(money), 'desc')).toBe(true))
    expect([...rowIds()].sort()).toEqual(PAID)
  })
})
