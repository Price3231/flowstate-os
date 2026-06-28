import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncToSheets } from '@/lib/sheets/sync'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Verify internal call or admin
    const supabase = await createAdminClient()

    // Fetch all data
    const [
      { data: members },
      { data: payments },
      { data: attendance },
      { data: expenses },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, phone, status, membership_start_date, membership_renewal_date, deposit_paid, waiver_accepted, notes, created_at, membership_type:membership_types(name)')
        .eq('role', 'student'),
      supabase
        .from('payments')
        .select('paid_at, amount, method, status, notes, user:profiles(full_name, email), membership_type:membership_types(name)')
        .order('paid_at', { ascending: false }),
      supabase
        .from('attendance')
        .select('attended, session:class_sessions(session_date, class:classes(title)), user:profiles(full_name, email)')
        .order('marked_at', { ascending: false })
        .limit(5000),
      supabase
        .from('expenses')
        .select('paid_at, category, description, amount')
        .order('paid_at', { ascending: false }),
    ])

    // Flatten nested objects for sheets
    const flatMembers = (members ?? []).map(m => ({
      ...m,
      membership_name: (m.membership_type as unknown as { name: string } | null)?.name ?? '',
    }))

    const flatPayments = (payments ?? []).map(p => ({
      ...p,
      member_name: (p.user as unknown as { full_name: string } | null)?.full_name ?? '',
      member_email: (p.user as unknown as { email: string } | null)?.email ?? '',
      membership_name: (p.membership_type as unknown as { name: string } | null)?.name ?? '',
    }))

    const flatAttendance = (attendance ?? []).map(a => ({
      ...a,
      session_date: (a.session as unknown as { session_date: string } | null)?.session_date ?? '',
      class_title: ((a.session as unknown as { class: { title: string } } | null)?.class)?.title ?? '',
      member_name: (a.user as unknown as { full_name: string } | null)?.full_name ?? '',
      member_email: (a.user as unknown as { email: string } | null)?.email ?? '',
    }))

    const result = await syncToSheets({
      members: flatMembers as Record<string, unknown>[],
      payments: flatPayments as Record<string, unknown>[],
      attendance: flatAttendance as Record<string, unknown>[],
      expenses: (expenses ?? []) as Record<string, unknown>[],
    })

    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
