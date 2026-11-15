export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'refunded'

export interface Order {
  id: string
  customer: string
  email: string
  total: number
  status: OrderStatus
  createdAt: string
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  title: string
  location: string
  avatarUrl: string
  bio: string
  lastActiveAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  progress: number
  tags: string[]
}

export interface Settings {
  displayName: string
  email: string
  timezone: string
  language: 'en' | 'fr' | 'de'
  emailNotifications: boolean
  weeklyDigest: boolean
  apiKey: string
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export interface Photo {
  id: string
  src: string
  title: string
  author: string
}
