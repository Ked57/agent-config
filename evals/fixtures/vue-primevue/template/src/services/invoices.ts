// Invoices data source: fixed seed data for the invoices list screen, shaped like an API response.
//
// Seed switch: open the page with `?seed=empty` to get a workspace without any invoices yet, for
// building and checking the empty state.

export type InvoiceStatus = 'Draft' | 'Open' | 'Overdue' | 'Paid'

export const invoiceStatuses: InvoiceStatus[] = ['Paid', 'Open', 'Overdue', 'Draft']

export interface Invoice {
  id: string
  /** Display number, e.g. "INV-2048". */
  number: string
  customer: { name: string; email: string }
  /** ISO dates (UTC midnight). */
  issuedAt: string
  dueAt: string
  status: InvoiceStatus
  /** USD. */
  amount: number
}

const customers = [
  { name: 'Northwind Traders', email: 'accounts.payable@northwind-traders.test' },
  { name: 'Globex Corporation', email: 'ap@globex.test' },
  { name: 'Initech', email: 'finance@initech.test' },
  { name: 'Umbrella Health', email: 'invoices@umbrella-health.test' },
  { name: 'Hooli', email: 'payables@hooli.test' },
  { name: 'Soylent Foods', email: 'billing@soylent.test' },
  { name: 'Stark Logistics', email: 'finance.team@stark-logistics.test' },
  { name: 'Wayne Analytics', email: 'ap@wayne-analytics.test' },
]

// number, customer index, issued (days before 2026-11-16), payment terms (days), status, amount
const rows: [number, number, number, number, InvoiceStatus, number][] = [
  [2048, 4, 1, 30, 'Draft', 3200],
  [2047, 0, 2, 30, 'Draft', 12450],
  [2046, 2, 4, 14, 'Open', 980],
  [2045, 6, 6, 30, 'Open', 7820.5],
  [2044, 1, 9, 30, 'Open', 15210],
  [2043, 3, 11, 14, 'Open', 2640],
  [2042, 7, 13, 30, 'Paid', 5400],
  [2041, 0, 15, 30, 'Open', 4250],
  [2040, 5, 18, 14, 'Overdue', 1875.25],
  [2039, 4, 20, 30, 'Paid', 9100],
  [2038, 2, 23, 14, 'Overdue', 640],
  [2037, 1, 25, 30, 'Paid', 18420],
  [2036, 6, 28, 30, 'Open', 3310],
  [2035, 3, 31, 30, 'Paid', 2280],
  [2034, 7, 34, 30, 'Paid', 6730],
  [2033, 0, 37, 30, 'Paid', 11900],
  [2032, 5, 40, 30, 'Overdue', 420],
  [2031, 2, 43, 30, 'Paid', 1150],
  [2030, 4, 46, 30, 'Paid', 8800],
  [2029, 1, 49, 30, 'Paid', 14300],
  [2028, 6, 52, 30, 'Paid', 2975],
  [2027, 3, 55, 30, 'Paid', 3640],
  [2026, 7, 58, 30, 'Paid', 7250],
  [2025, 5, 61, 30, 'Paid', 1990],
]

const day = 24 * 60 * 60 * 1000
const today = Date.UTC(2026, 10, 16)
const iso = (time: number) => new Date(time).toISOString().slice(0, 10)

const invoices: Invoice[] = rows.map(([number, customer, issued, terms, status, amount]) => ({
  id: `inv_${number}`,
  number: `INV-${number}`,
  customer: { ...customers[customer]! },
  issuedAt: iso(today - issued * day),
  dueAt: iso(today - issued * day + terms * day),
  status,
  amount,
}))

function seed(): string | null {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('seed')
}

/** All invoices, newest first. */
export async function fetchInvoices(): Promise<Invoice[]> {
  return seed() === 'empty' ? [] : invoices.map((invoice) => ({ ...invoice, customer: { ...invoice.customer } }))
}
