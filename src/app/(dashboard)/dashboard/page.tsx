import { createClient } from '@/lib/supabase/server'
import { StatCard, Card, Badge, EmptyState } from '@/components/ui'
import { formatCurrency, formatDate, STATUS_COLOURS } from '@/lib/utils'
import {
  Users,
  UserPlus,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch all stats in parallel
  const [
    { count: activeMembers },
    { count: trialMembers },
    { count: newMembers },
    { data: payments },
    { data: expenses },
    { data: atRisk },
    { data: todaySessions },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('role', 'student'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'trial').eq('role', 'student'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('payments').select('amount, status, method').gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('expenses').select('amount').gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    supabase.from('at_risk_members').select('id, full_name, email, last_attendance').limit(10),
    supabase.from('class_sessions').select('id, session_date, class:classes(title, start_time, max_capacity), bookings(status)').eq('session_date', new Date().toISOString().split('T')[0]).eq('cancelled', false),
  ])

  const monthRevenue = payments?.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0) ?? 0
  const outstandingPayments = payments?.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0) ?? 0
  const monthExpenses = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const monthProfit = monthRevenue - monthExpenses

  const todayAttendance = todaySessions?.reduce((s, sess) => {
    const confirmed = (sess.bookings as {status: string}[])?.filter(b => b.status === 'confirmed').length ?? 0
    return s + confirmed
  }, 0) ?? 0

  const totalCapacity = todaySessions?.reduce((s, sess) => {
    const cls = sess.class as unknown as {max_capacity: number} | null
    return s + (cls?.max_capacity ?? 0)
  }, 0) ?? 0

  const avgOccupancy = totalCapacity > 0 ? Math.round((todayAttendance / totalCapacity) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <StatCard label="Active Members" value={activeMembers ?? 0} icon={Users} />
        <StatCard label="Trial Members" value={trialMembers ?? 0} icon={UserPlus} />
        <StatCard label="New This Month" value={newMembers ?? 0} icon={Activity} />
        <StatCard label="Today's Classes" value={todaySessions?.length ?? 0} icon={Calendar} />
        <StatCard label="Today's Bookings" value={todayAttendance} sub={`${avgOccupancy}% occupancy`} icon={Clock} />
        <StatCard label="Month Revenue" value={formatCurrency(monthRevenue)} icon={TrendingUp} accent />
        <StatCard label="Month Expenses" value={formatCurrency(monthExpenses)} icon={TrendingDown} />
        <StatCard label="Month Profit" value={formatCurrency(monthProfit)} icon={DollarSign} accent={monthProfit > 0} />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstandingPayments)}
          icon={AlertTriangle}
          accent={outstandingPayments > 0}
        />
        <StatCard label="At Risk Members" value={atRisk?.length ?? 0} sub="No class in 14+ days" icon={AlertTriangle} accent={(atRisk?.length ?? 0) > 0} />
      </div>

      {/* Lower row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Today's Schedule */}
        <Card>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Today&apos;s Schedule</h2>
          </div>
          {todaySessions && todaySessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todaySessions.map((session) => {
                const cls = session.class as unknown as {title: string; start_time: string; max_capacity: number} | null
                const confirmed = (session.bookings as {status: string}[])?.filter(b => b.status === 'confirmed').length ?? 0
                const maxCap = cls?.max_capacity ?? 16
                const pct = Math.round((confirmed / maxCap) * 100)
                return (
                  <div
                    key={session.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{cls?.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {cls?.start_time?.slice(0, 5)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {confirmed}/{maxCap}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: pct > 85 ? 'var(--accent)' : 'var(--text-muted)', marginTop: 2 }}>
                        {pct}% full
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="No classes scheduled today" />
          )}
        </Card>

        {/* At Risk Members */}
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>At Risk Members</h2>
            <Badge color="#e85d26">{atRisk?.length ?? 0}</Badge>
          </div>
          {atRisk && atRisk.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {atRisk.map((member) => {
                const m = member as {id: string; full_name: string; email: string; last_attendance: string | null}
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{m.full_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.email}</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {m.last_attendance ? `Last: ${formatDate(m.last_attendance)}` : 'Never attended'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="All members are engaged 🏆" />
          )}
        </Card>
      </div>
    </div>
  )
}
