// Analytics data source: fixed seed data for the analytics screen, shaped like an API response.
//
// Seed switch: open the page with `?seed=empty` to get a workspace with no customers and no
// activity yet (KPIs and the revenue series stay), for building and checking empty states.

export type DateRange = '7d' | '30d' | '90d'

export const dateRanges: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export const defaultDateRange: DateRange = '30d'

export type KpiFormat = 'currency' | 'number' | 'percent'

export interface Kpi {
  id: 'revenue' | 'customers' | 'orders' | 'conversion'
  label: string
  value: number
  format: KpiFormat
  /** Change against the previous period of the same length, in percent (negative = down). */
  delta: number
  /** Values for a small trend line, oldest first. */
  trend: number[]
}

export interface RevenuePoint {
  /** Short axis label, e.g. "Nov 2". */
  label: string
  revenue: number
}

export type CustomerStatus = 'Active' | 'Trial' | 'Past due' | 'Churned'

export interface Customer {
  id: string
  name: string
  email: string
  plan: 'Starter' | 'Growth' | 'Enterprise'
  status: CustomerStatus
  /** Revenue in the selected period, USD. */
  revenue: number
  orders: number
}

export interface Activity {
  id: string
  actor: string
  /** What happened, e.g. "upgraded to Enterprise". */
  text: string
  /** ISO timestamp. */
  at: string
  kind: 'upgrade' | 'payment' | 'signup' | 'refund' | 'cancellation'
}

export interface Analytics {
  range: DateRange
  kpis: Kpi[]
  revenue: RevenuePoint[]
  customers: Customer[]
  activity: Activity[]
}

const kpisByRange: Record<DateRange, Kpi[]> = {
  '7d': [
    { id: 'revenue', label: 'Revenue', value: 28450, format: 'currency', delta: 4.2, trend: [3.6, 3.9, 4.1, 3.8, 4.3, 4.2, 4.6] },
    { id: 'customers', label: 'Active customers', value: 1284, format: 'number', delta: 1.1, trend: [1262, 1266, 1270, 1271, 1277, 1280, 1284] },
    { id: 'orders', label: 'Orders', value: 342, format: 'number', delta: -3.4, trend: [52, 49, 50, 47, 48, 46, 50] },
    { id: 'conversion', label: 'Conversion rate', value: 3.1, format: 'percent', delta: 0.6, trend: [2.9, 3.0, 3.0, 3.1, 3.0, 3.2, 3.1] },
  ],
  '30d': [
    { id: 'revenue', label: 'Revenue', value: 124580, format: 'currency', delta: 12.4, trend: [21, 24, 23, 27, 26, 30, 33] },
    { id: 'customers', label: 'Active customers', value: 1284, format: 'number', delta: 5.8, trend: [1180, 1196, 1215, 1229, 1248, 1266, 1284] },
    { id: 'orders', label: 'Orders', value: 1462, format: 'number', delta: 8.1, trend: [190, 205, 199, 214, 220, 211, 223] },
    { id: 'conversion', label: 'Conversion rate', value: 2.9, format: 'percent', delta: -1.7, trend: [3.2, 3.1, 3.1, 3.0, 2.9, 2.9, 2.9] },
  ],
  '90d': [
    { id: 'revenue', label: 'Revenue', value: 351920, format: 'currency', delta: 18.9, trend: [88, 92, 97, 101, 108, 113, 121] },
    { id: 'customers', label: 'Active customers', value: 1284, format: 'number', delta: 14.3, trend: [1050, 1092, 1131, 1170, 1208, 1250, 1284] },
    { id: 'orders', label: 'Orders', value: 4210, format: 'number', delta: 10.5, trend: [560, 575, 590, 602, 615, 630, 638] },
    { id: 'conversion', label: 'Conversion rate', value: 2.8, format: 'percent', delta: -2.4, trend: [3.1, 3.0, 2.9, 2.9, 2.8, 2.8, 2.8] },
  ],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Deterministic revenue series ending on 2026-11-15: daily for 7 and 30 days, weekly for 90 days. */
function revenueSeries(range: DateRange): RevenuePoint[] {
  const points = range === '7d' ? 7 : range === '30d' ? 30 : 13
  const stepDays = range === '90d' ? 7 : 1
  const end = Date.UTC(2026, 10, 15)
  const base = range === '90d' ? 24000 : 3400
  return Array.from({ length: points }, (_, index) => {
    const day = new Date(end - (points - 1 - index) * stepDays * 86_400_000)
    const wave = Math.sin(index * 1.3) * 0.12 + Math.cos(index * 0.55) * 0.08
    const growth = index / points / 3
    return {
      label: `${MONTHS[day.getUTCMonth()]} ${day.getUTCDate()}`,
      revenue: Math.round(base * (1 + wave + growth)),
    }
  })
}

const customers: Customer[] = [
  { id: 'c1', name: 'Northwind Traders', email: 'billing@northwind.test', plan: 'Enterprise', status: 'Active', revenue: 18420, orders: 214 },
  { id: 'c2', name: 'Globex Corporation', email: 'ap@globex.test', plan: 'Enterprise', status: 'Active', revenue: 15210, orders: 168 },
  { id: 'c3', name: 'Initech', email: 'finance@initech.test', plan: 'Growth', status: 'Past due', revenue: 9875, orders: 121 },
  { id: 'c4', name: 'Umbrella Health', email: 'accounts@umbrella.test', plan: 'Growth', status: 'Active', revenue: 8640, orders: 97 },
  { id: 'c5', name: 'Hooli', email: 'payables@hooli.test', plan: 'Starter', status: 'Trial', revenue: 4120, orders: 58 },
  { id: 'c6', name: 'Soylent Foods', email: 'billing@soylent.test', plan: 'Starter', status: 'Churned', revenue: 2310, orders: 31 },
]

const activity: Activity[] = [
  { id: 'a1', actor: 'Northwind Traders', text: 'upgraded to Enterprise', at: '2026-11-15T16:42:00Z', kind: 'upgrade' },
  { id: 'a2', actor: 'Globex Corporation', text: 'paid invoice INV-2041', at: '2026-11-15T11:05:00Z', kind: 'payment' },
  { id: 'a3', actor: 'Hooli', text: 'started a trial', at: '2026-11-14T09:30:00Z', kind: 'signup' },
  { id: 'a4', actor: 'Initech', text: 'was refunded $320.00', at: '2026-11-13T14:18:00Z', kind: 'refund' },
  { id: 'a5', actor: 'Soylent Foods', text: 'cancelled their subscription', at: '2026-11-12T08:50:00Z', kind: 'cancellation' },
]

function seed(): string | null {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('seed')
}

/** Analytics for a date range. Customer revenue scales with the range; the lists are sorted for display. */
export async function fetchAnalytics(range: DateRange = defaultDateRange): Promise<Analytics> {
  const empty = seed() === 'empty'
  const scale = range === '7d' ? 0.25 : range === '90d' ? 2.8 : 1
  return {
    range,
    kpis: kpisByRange[range].map((kpi) => ({ ...kpi, trend: [...kpi.trend] })),
    revenue: revenueSeries(range),
    customers: empty ? [] : customers.map((customer) => ({
      ...customer,
      revenue: Math.round(customer.revenue * scale),
      orders: Math.round(customer.orders * scale),
    })),
    activity: empty ? [] : activity.map((item) => ({ ...item })),
  }
}
