// Pricing data source: fixed seed data for the public pricing screen, shaped like an API response.
// Prices are USD per month; `yearly` is the per-month price when billed yearly (null = custom quote).

export type BillingPeriod = 'monthly' | 'yearly'

export interface Plan {
  id: 'starter' | 'growth' | 'scale' | 'enterprise'
  name: string
  description: string
  price: { monthly: number; yearly: number } | null
  /** Shown instead of a price for custom quotes. */
  priceNote?: string
  cta: string
  highlighted: boolean
  /** Short feature list for the plan card; the first line may say what it builds on. */
  features: string[]
}

/** A comparison cell: included (true), not included (false) or a value such as "5" or "30 days". */
export type ComparisonValue = boolean | string

export interface ComparisonGroup {
  label: string
  rows: { feature: string; values: Record<Plan['id'], ComparisonValue> }[]
}

export interface Faq {
  id: string
  question: string
  answer: string
}

export interface Pricing {
  yearlyDiscountPercent: number
  plans: Plan[]
  comparison: ComparisonGroup[]
  faqs: Faq[]
}

const plans: Plan[] = [
  {
    id: 'starter', name: 'Starter', description: 'For small teams getting their first projects in order.',
    price: { monthly: 12, yearly: 10 }, cta: 'Get started', highlighted: false,
    features: ['Up to 5 members', '10 active projects', 'Basic reports', 'Email support'],
  },
  {
    id: 'growth', name: 'Growth', description: 'For growing teams that need reporting and automation.',
    price: { monthly: 29, yearly: 24 }, cta: 'Start free trial', highlighted: true,
    features: ['Everything in Starter', 'Up to 25 members', 'Unlimited projects', 'Advanced reports and exports', 'Workflow automation', 'Priority support'],
  },
  {
    id: 'scale', name: 'Scale', description: 'For organisations with many teams and stricter controls.',
    price: { monthly: 79, yearly: 66 }, cta: 'Get started', highlighted: false,
    features: ['Everything in Growth', 'Unlimited members', 'Audit log', 'SAML single sign-on', 'Custom roles'],
  },
  {
    id: 'enterprise', name: 'Enterprise', description: 'For companies with security reviews and procurement.',
    price: null, priceNote: 'Volume pricing, invoiced yearly', cta: 'Contact sales', highlighted: false,
    features: ['Everything in Scale', 'Dedicated success manager', 'Uptime SLA of 99.95%', 'Data residency in the EU or US'],
  },
]

const comparison: ComparisonGroup[] = [
  {
    label: 'Workspace',
    rows: [
      { feature: 'Members', values: { starter: '5', growth: '25', scale: 'Unlimited', enterprise: 'Unlimited' } },
      { feature: 'Active projects', values: { starter: '10', growth: 'Unlimited', scale: 'Unlimited', enterprise: 'Unlimited' } },
      { feature: 'Report history', values: { starter: '30 days', growth: '1 year', scale: '3 years', enterprise: 'Unlimited' } },
      { feature: 'Workflow automation', values: { starter: false, growth: true, scale: true, enterprise: true } },
    ],
  },
  {
    label: 'Security',
    rows: [
      { feature: 'Two-factor authentication', values: { starter: true, growth: true, scale: true, enterprise: true } },
      { feature: 'Audit log', values: { starter: false, growth: false, scale: true, enterprise: true } },
      { feature: 'SAML single sign-on', values: { starter: false, growth: false, scale: true, enterprise: true } },
    ],
  },
  {
    label: 'Support',
    rows: [
      { feature: 'Support channel', values: { starter: 'Email', growth: 'Priority', scale: 'Priority', enterprise: 'Dedicated' } },
      { feature: 'Uptime SLA', values: { starter: false, growth: false, scale: false, enterprise: true } },
    ],
  },
]

const faqs: Faq[] = [
  { id: 'change', question: 'Can I change plans later?', answer: 'Yes. Upgrades take effect immediately and we charge the difference pro rata; downgrades apply at the end of your billing period.' },
  { id: 'trial', question: 'How does the free trial work?', answer: 'Growth comes with a 14-day trial. No card is needed, and your workspace moves to Starter if you do not upgrade.' },
  { id: 'seats', question: 'What counts as a member?', answer: 'Anyone who can sign in to your workspace. Guests who only view shared reports are free.' },
  { id: 'invoice', question: 'Can we pay by invoice?', answer: 'Yearly Scale and Enterprise plans can be paid by bank transfer against an invoice with 30-day terms.' },
  { id: 'cancel', question: 'What happens if we cancel?', answer: 'You keep access until the end of the period you paid for, and can export all projects and reports for 90 days.' },
]

export async function fetchPricing(): Promise<Pricing> {
  return {
    yearlyDiscountPercent: 20,
    plans: plans.map((plan) => ({ ...plan, features: [...plan.features] })),
    comparison: comparison.map((group) => ({ ...group, rows: group.rows.map((row) => ({ ...row, values: { ...row.values } })) })),
    faqs: faqs.map((faq) => ({ ...faq })),
  }
}
