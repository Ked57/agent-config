// Customer account data source: fixed seed data for the account detail screen, shaped like an API
// response. `updateAccount` resolves with the merged account without persisting anything.

export type AccountHealth = 'Healthy' | 'At risk' | 'Churning'

export interface AccountContact {
  id: string
  name: string
  title: string
  email: string
  phone: string
  primary: boolean
}

export interface AccountEvent {
  id: string
  kind: 'call' | 'email' | 'invoice' | 'note' | 'plan'
  title: string
  detail: string
  actor: string
  /** ISO timestamp. */
  at: string
}

export interface CustomerAccount {
  id: string
  name: string
  domain: string
  health: AccountHealth
  plan: 'Starter' | 'Growth' | 'Scale' | 'Enterprise'
  owner: string
  /** ISO date. */
  customerSince: string
  renewsAt: string
  monthlyRevenue: number
  openInvoices: number
  /** 0–100. */
  healthScore: number
  details: { industry: string; employees: string; headquarters: string; timeZone: string }
  billing: { paymentMethod: string; billingEmail: string; taxId: string; nextInvoice: string }
  notes: string
  contacts: AccountContact[]
  activity: AccountEvent[]
  invoiceCount: number
}

export const accountOwners = ['Maria Kowalski', 'Jonas Berg', 'Priya Natarajan', 'Sam Okafor']
export const accountPlans: CustomerAccount['plan'][] = ['Starter', 'Growth', 'Scale', 'Enterprise']

const account: CustomerAccount = {
  id: 'northwind',
  name: 'Northwind Traders',
  domain: 'northwind-traders.test',
  health: 'At risk',
  plan: 'Enterprise',
  owner: 'Maria Kowalski',
  customerSince: '2023-03-14',
  renewsAt: '2027-01-31',
  monthlyRevenue: 4820,
  openInvoices: 2,
  healthScore: 62,
  details: { industry: 'Wholesale distribution', employees: '201–500', headquarters: 'Seattle, WA, United States', timeZone: 'Pacific Time (UTC−08:00)' },
  billing: { paymentMethod: 'Visa ending in 4242', billingEmail: 'accounts.payable@northwind-traders.test', taxId: 'US 94-1234567', nextInvoice: '2026-12-01' },
  notes: 'Evaluating a move to Scale after the warehouse team shrank. Wants SSO before renewing.',
  contacts: [
    { id: 'c1', name: 'Dana Whitfield', title: 'Head of Operations', email: 'dana.whitfield@northwind-traders.test', phone: '+1 206 555 0148', primary: true },
    { id: 'c2', name: 'Luis Ortega', title: 'Finance Manager', email: 'luis.ortega@northwind-traders.test', phone: '+1 206 555 0193', primary: false },
    { id: 'c3', name: 'Mei Tanaka', title: 'IT Administrator', email: 'mei.tanaka@northwind-traders.test', phone: '+1 206 555 0110', primary: false },
    { id: 'c4', name: 'Grace Holloway', title: 'Warehouse Lead', email: 'grace.holloway@northwind-traders.test', phone: '+1 206 555 0175', primary: false },
  ],
  activity: [
    { id: 'a1', kind: 'call', title: 'Renewal call scheduled', detail: 'Dec 3 with Dana Whitfield and Luis Ortega', actor: 'Maria Kowalski', at: '2026-11-15T16:20:00Z' },
    { id: 'a2', kind: 'invoice', title: 'Invoice INV-2047 sent', detail: '$12,450.00, due Dec 14', actor: 'Billing', at: '2026-11-14T09:05:00Z' },
    { id: 'a3', kind: 'email', title: 'Asked about SAML single sign-on', detail: 'Mei Tanaka needs SSO before the security review', actor: 'Mei Tanaka', at: '2026-11-10T13:42:00Z' },
    { id: 'a4', kind: 'plan', title: 'Seats reduced from 120 to 85', detail: 'Warehouse team restructured', actor: 'Dana Whitfield', at: '2026-10-28T11:00:00Z' },
    { id: 'a5', kind: 'note', title: 'Health score dropped to 62', detail: 'Weekly active users down 18% in October', actor: 'Acme Console', at: '2026-10-21T07:00:00Z' },
  ],
  invoiceCount: 12,
}

export async function fetchAccount(): Promise<CustomerAccount> {
  return structuredClone(account)
}

export async function updateAccount(current: CustomerAccount, changes: Partial<Pick<CustomerAccount, 'name' | 'owner' | 'plan' | 'notes'>>): Promise<CustomerAccount> {
  // A JSON copy: `current` may be a reactive proxy, which structuredClone cannot copy.
  return { ...(JSON.parse(JSON.stringify(current)) as CustomerAccount), ...changes }
}
