import { createClient } from '@/lib/supabase/server'
import { Card, StatCard, Badge } from '@/components/ui'
import { formatDate, formatCurrency, STATUS_COLOURS } from '@/lib/utils'
import Link from 'next/link'

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: bookings }, { data: payments }] = await Promise.all([
    supabase.from('profiles').select('*, membership_type:membership_types(name, price)').eq('id', user!.id).single(),
    supabase.from('bookings').select('*, session:class_sessions(session_date, class:classes(title, start_time))').eq('user_id', user!.id).eq('status', 'confirmed').gte('session.session_date' as string, new Date().toISOString().split('T')[0]).order('booked_at', { ascending: false }).limit(5),
    supabase.from('payments').select('amount, status, paid_at, membership_type:membership_types(name)').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
  ])

  const mt = profile?.membership_type as { name: string; price: number } | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          Welcome back, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <StatCard label="Status" value={profile?.status ?? '—'} />
        <StatCard label="Membership" value={mt?.name ?? 'None'} />
        <StatCard label="Renewal" value={profile?.membership_renewal_date ? formatDate(profile.membership_renewal_date) : '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Upcoming bookings */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Upcoming Classes</h2>
            <Link href="/student/timetable" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none' }}>Book more →</Link>
          </div>
          {bookings && bookings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bookings.map(b => {
                const sess = b.session as { session_date: string; class: { title: string; start_time: string } } | null
                return (
                  <div key={b.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{sess?.class?.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{sess?.session_date} · {sess?.class?.start_time?.slice(0, 5)}</div>
                    </div>
                    <Badge color="#22c55e">Confirmed</Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No upcoming bookings</p>
          )}
        </Card>

        {/* Recent payments */}
        <Card>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 14 }}>Payment History</h2>
          {payments && payments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map((p, i) => {
                const mt2 = p.membership_type as unknown as { name: string } | undefined
                return (
                  <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{mt2?.name ?? 'Payment'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.paid_at ? formatDate(p.paid_at) : 'Pending'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatCurrency(p.amount)}</span>
                      <Badge color={STATUS_COLOURS[p.status]}>{p.status}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No payments yet</p>
          )}
        </Card>
      </div>
    </div>
  )
}
