// Account settings data source: fixed seed data for the account settings screen, shaped like an API
// response. `saveProfile` resolves without persisting anything.

export interface Profile {
  firstName: string
  lastName: string
  email: string
  emailVerified: boolean
  jobTitle: string
  timeZone: string
  bio: string
}

export const bioMaxLength = 160

export const timeZones: { value: string; label: string }[] = [
  { value: 'America/New_York', label: '(UTC−05:00) New York' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Europe/Warsaw', label: '(UTC+01:00) Warsaw' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore' },
]

export type Channel = 'email' | 'push' | 'sms'

export const channels: { id: Channel; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'push', label: 'Push' },
  { id: 'sms', label: 'SMS' },
]

export interface NotificationEvent {
  id: string
  label: string
  description: string
  /** Required events are always delivered by email and cannot be switched off there. */
  required: boolean
  channels: Record<Channel, boolean>
}

export interface AccountSettings {
  profile: Profile
  notifications: NotificationEvent[]
  workspace: { name: string; members: number }
}

const profile: Profile = {
  firstName: 'Maria',
  lastName: 'Kowalski',
  email: 'maria.kowalski@acme.test',
  emailVerified: true,
  jobTitle: 'Product designer',
  timeZone: 'Europe/Warsaw',
  bio: 'Designs the billing and onboarding flows. Ask me about invoices, plans and empty states.',
}

const notifications: NotificationEvent[] = [
  { id: 'comments', label: 'Comments', description: 'Replies and comments on your projects', required: false, channels: { email: true, push: true, sms: false } },
  { id: 'mentions', label: 'Mentions', description: 'Someone mentions you with @', required: false, channels: { email: true, push: true, sms: true } },
  { id: 'summary', label: 'Weekly summary', description: 'Activity digest every Monday morning', required: false, channels: { email: true, push: false, sms: false } },
  { id: 'billing', label: 'Billing', description: 'Invoices, receipts and failed payments', required: false, channels: { email: true, push: false, sms: false } },
  { id: 'security', label: 'Security alerts', description: 'New sign-ins and password changes', required: true, channels: { email: true, push: true, sms: false } },
]

export async function fetchAccountSettings(): Promise<AccountSettings> {
  return {
    profile: { ...profile },
    notifications: notifications.map((event) => ({ ...event, channels: { ...event.channels } })),
    workspace: { name: 'Acme Inc.', members: 24 },
  }
}

export async function saveProfile(next: Profile): Promise<Profile> {
  return { ...next }
}
