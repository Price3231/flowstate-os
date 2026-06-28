import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-MT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  coaches: 'Coaches',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  editing_costs: 'Editing Costs',
  videographer_costs: 'Videographer',
  other_marketing: 'Other Marketing',
  miscellaneous: 'Miscellaneous',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  cash: 'Cash',
  revolut: 'Revolut',
  bank_transfer: 'Bank Transfer',
}

export const STATUS_COLOURS: Record<string, string> = {
  active: '#22c55e',
  frozen: '#3b82f6',
  cancelled: '#ef4444',
  trial: '#f59e0b',
  paid: '#22c55e',
  pending: '#f59e0b',
  failed: '#ef4444',
  confirmed: '#22c55e',
  waitlisted: '#f59e0b',
}
