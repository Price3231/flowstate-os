export type UserRole = 'admin' | 'student'
export type MemberStatus = 'active' | 'frozen' | 'cancelled' | 'trial'
export type PaymentMethod = 'stripe' | 'cash' | 'revolut' | 'bank_transfer'
export type PaymentStatus = 'paid' | 'pending' | 'failed'
export type BookingStatus = 'confirmed' | 'waitlisted' | 'cancelled'
export type MembershipCategory = 'adult' | 'adult_3m' | 'kids' | 'other'
export type ExpenseCategory =
  | 'coaches'
  | 'meta_ads'
  | 'google_ads'
  | 'editing_costs'
  | 'videographer_costs'
  | 'other_marketing'
  | 'miscellaneous'
export type EmailTrigger = 'at_risk' | 'welcome' | 'payment_reminder' | 'custom'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  role: UserRole
  membership_type_id?: string
  membership_type?: MembershipType
  membership_start_date?: string
  membership_renewal_date?: string
  payment_method?: PaymentMethod
  status: MemberStatus
  deposit_paid: boolean
  waiver_accepted: boolean
  waiver_accepted_at?: string
  waiver_version?: string
  notes?: string
  created_at: string
}

export interface MembershipType {
  id: string
  name: string
  category: MembershipCategory
  price: number
  sessions_per_week?: number
  duration_months: number
  stripe_price_id?: string
}

export interface Class {
  id: string
  title: string
  description?: string
  day_of_week: number
  start_time: string
  end_time: string
  max_capacity: number
  is_active: boolean
}

export interface ClassSession {
  id: string
  class_id: string
  class?: Class
  session_date: string
  cancelled: boolean
  booking_count?: number
  bookings?: Booking[]
}

export interface Booking {
  id: string
  session_id: string
  session?: ClassSession
  user_id: string
  user?: Profile
  status: BookingStatus
  booked_at: string
  cancelled_at?: string
}

export interface Attendance {
  id: string
  session_id: string
  session?: ClassSession
  user_id: string
  user?: Profile
  attended: boolean
  marked_at: string
  adjusted_by?: string
}

export interface Payment {
  id: string
  user_id: string
  user?: Profile
  membership_type_id?: string
  membership_type?: MembershipType
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  stripe_payment_intent_id?: string
  notes?: string
  paid_at: string
  created_at: string
}

export interface Expense {
  id: string
  category: ExpenseCategory
  amount: number
  description: string
  paid_at: string
  created_at: string
  added_by: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  trigger: EmailTrigger
}

export interface WaiverVersion {
  id: string
  version_number: string
  content: string
  created_at: string
}

export interface DashboardStats {
  activeMembers: number
  trialMembers: number
  todayClasses: number
  todayAttendance: number
  monthRevenue: number
  monthExpenses: number
  monthProfit: number
  outstandingPayments: number
  atRiskMembers: number
  newMembersThisMonth: number
  avgClassOccupancy: number
}

export interface FinanceStats {
  monthRevenue: number
  monthExpenses: number
  monthProfit: number
  revenueByMembership: { name: string; amount: number }[]
  cashReceived: number
  stripeReceived: number
  revolutReceived: number
  bankTransferReceived: number
  outstandingPayments: number
  recurringMonthlyRevenue: number
}
