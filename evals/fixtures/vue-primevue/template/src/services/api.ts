import type { FaqItem, Order, Photo, Project, Settings, User } from '@/types'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

const users: User[] = [
  { id: 'u1', name: 'Ada Lovelace', email: 'ada@acme.test', role: 'admin', title: 'Head of Platform', location: 'London', avatarUrl: '/images/avatar-1.png', bio: 'Keeps the analytics engine running.', lastActiveAt: '2026-11-14T09:12:00Z' },
  { id: 'u2', name: 'Grace Hopper', email: 'grace@acme.test', role: 'editor', title: 'Staff Engineer', location: 'Arlington', avatarUrl: '/images/avatar-2.png', bio: 'Compilers, debugging, and naval time.', lastActiveAt: '2026-11-13T16:40:00Z' },
  { id: 'u3', name: 'Alan Turing', email: 'alan@acme.test', role: 'viewer', title: 'Research Lead', location: 'Manchester', avatarUrl: '/images/avatar-3.png', bio: 'Thinks about what machines can do.', lastActiveAt: '2026-11-10T11:05:00Z' },
  { id: 'u4', name: 'Katherine Johnson', email: 'katherine@acme.test', role: 'editor', title: 'Data Scientist', location: 'Hampton', avatarUrl: '/images/avatar-4.png', bio: 'Trajectories and forecasting.', lastActiveAt: '2026-11-15T07:30:00Z' },
  { id: 'u5', name: 'Linus Torvalds', email: 'linus@acme.test', role: 'viewer', title: 'Contractor', location: 'Portland', avatarUrl: '/images/avatar-5.png', bio: 'Reviews patches with feeling.', lastActiveAt: '2026-11-01T18:22:00Z' },
]

let orders: Order[] = [
  { id: 'ORD-1001', customer: 'Northwind', email: 'buyer@northwind.test', total: 1250.5, status: 'paid', createdAt: '2026-11-02T10:00:00Z' },
  { id: 'ORD-1002', customer: 'Globex', email: 'ap@globex.test', total: 89.99, status: 'pending', createdAt: '2026-11-03T14:30:00Z' },
  { id: 'ORD-1003', customer: 'Initech', email: 'bill@initech.test', total: 432, status: 'shipped', createdAt: '2026-11-05T08:15:00Z' },
  { id: 'ORD-1004', customer: 'Umbrella', email: 'pay@umbrella.test', total: 2999, status: 'refunded', createdAt: '2026-11-06T17:45:00Z' },
  { id: 'ORD-1005', customer: 'Hooli', email: 'finance@hooli.test', total: 610.25, status: 'paid', createdAt: '2026-11-08T12:00:00Z' },
  { id: 'ORD-1006', customer: 'Stark Industries', email: 'ap@stark.test', total: 15000, status: 'shipped', createdAt: '2026-11-09T09:20:00Z' },
  { id: 'ORD-1007', customer: 'Wayne Enterprises', email: 'orders@wayne.test', total: 720, status: 'pending', createdAt: '2026-11-11T19:05:00Z' },
  { id: 'ORD-1008', customer: 'Soylent', email: 'billing@soylent.test', total: 58.4, status: 'paid', createdAt: '2026-11-12T07:50:00Z' },
]

const projects: Project[] = [
  { id: 'p1', name: 'Checkout revamp', description: 'Rebuild the checkout flow with fewer steps and saved payment methods.', ownerId: 'u2', progress: 72, tags: ['web', 'payments'] },
  { id: 'p2', name: 'Usage analytics', description: 'Event pipeline and dashboards for product usage.', ownerId: 'u1', progress: 40, tags: ['data'] },
  { id: 'p3', name: 'Mobile onboarding', description: 'Shorter onboarding for the mobile app with progressive profiling.', ownerId: 'u4', progress: 15, tags: ['mobile', 'growth'] },
  { id: 'p4', name: 'Billing migration', description: 'Move invoices to the new billing provider without downtime.', ownerId: 'u2', progress: 90, tags: ['payments', 'infra'] },
  { id: 'p5', name: 'Search relevance', description: 'Tune ranking for the product catalogue search.', ownerId: 'u3', progress: 55, tags: ['data', 'web'] },
  { id: 'p6', name: 'Design tokens', description: 'Unify colours, spacing and typography across apps.', ownerId: 'u4', progress: 30, tags: ['design'] },
]

let settings: Settings = {
  displayName: 'Ada Lovelace',
  email: 'ada@acme.test',
  timezone: 'Europe/London',
  language: 'en',
  emailNotifications: true,
  weeklyDigest: false,
  apiKey: 'acme_demo_key_not_a_secret',
}

const faq: FaqItem[] = [
  { id: 'f1', question: 'How do I invite a teammate?', answer: 'Open Users, choose Invite, and enter their email address. They receive a link that expires after seven days.' },
  { id: 'f2', question: 'Can I export my orders?', answer: 'Yes. On the dashboard, use the export menu above the orders table to download a CSV of the current filter.' },
  { id: 'f3', question: 'Where do I find my API key?', answer: 'Your API key is under Settings. Treat it like a password and rotate it if it leaks.' },
  { id: 'f4', question: 'How is billing calculated?', answer: 'Billing is per active seat per month. Viewers are free.' },
  { id: 'f5', question: 'How do I delete my account?', answer: 'Contact support from the account owner email address. Deletion is permanent after 30 days.' },
]

const photos: Photo[] = Array.from({ length: 12 }, (_, index) => ({
  id: `ph${index + 1}`,
  src: `/images/photo-${index + 1}.png`,
  title: ['Harbour at dawn', 'Pine ridge', 'Night market', 'Salt flats', 'Old town', 'Glacier walk'][index % 6] ?? 'Untitled',
  author: users[index % users.length]?.name ?? 'Unknown',
}))

export async function fetchOrders(): Promise<Order[]> {
  await delay()
  return structuredClone(orders)
}

export async function deleteOrder(id: string): Promise<void> {
  await delay()
  orders = orders.filter((order) => order.id !== id)
}

export async function fetchUsers(): Promise<User[]> {
  await delay()
  return structuredClone(users)
}

export async function fetchProjects(): Promise<Project[]> {
  await delay()
  return structuredClone(projects)
}

export async function fetchSettings(): Promise<Settings> {
  await delay()
  return structuredClone(settings)
}

export async function saveSettings(next: Settings): Promise<Settings> {
  await delay(500)
  settings = structuredClone(next)
  return structuredClone(settings)
}

export async function fetchFaq(): Promise<FaqItem[]> {
  await delay(100)
  return structuredClone(faq)
}

export async function fetchPhotos(): Promise<Photo[]> {
  await delay(100)
  return structuredClone(photos)
}
