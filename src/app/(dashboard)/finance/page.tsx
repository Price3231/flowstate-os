'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SectionHeader, StatCard, Card, Loader } from '@/components/ui'
import { formatCurrency, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function FinancePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<{ amount: number; method: string; status: string; paid_at: string; membership_type?: { name: string } }[]>([])
  const [expenses, setExpenses] = useState<{ amount: number; paid_at: string }[]>([])

  useEffect(() => {
    const fetch = async () => {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase.from('payments').select('amount, method, status, paid_at, membership_type:membership_types(name)').gte('paid_at', yearStart),
        supabase.from('expenses').select('amount, paid_at').gte('paid_at', yearStart.split('T')[0]),
      ])
      setPayments((p ?? []) as unknown as typeof payments)
      setExpenses(e ?? [])
      setLoading(false)
    }
    fetch()
  }, [supabase])

  const now = new Date()
  const thisMonth = (p: { paid_at: string }) => {
    const d = new Date(p.paid_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }

  const paid = payments.filter(p => p.status === 'paid')
  const monthRevenue = paid.filter(thisMonth).reduce((s, p) => s + p.amount, 0)
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.paid_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, e) => s + e.amount, 0)
  const outstanding = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)

  // Monthly revenue vs expenses chart
  const monthlyData = MONTHS.map((month, i) => {
    const rev = paid.filter(p => new Date(p.paid_at).getMonth() === i).reduce((s, p) => s + p.amount, 0)
    const exp = expenses.filter(e => new Date(e.paid_at).getMonth() === i).reduce((s, e) => s + e.amount, 0)
    return { month, revenue: rev, expenses: exp, profit: rev - exp }
  }).filter((_, i) => i <= now.getMonth())

  // By method
  const byMethod = (['stripe', 'cash', 'revolut', 'bank_transfer'] as const).map(method => ({
    name: PAYMENT_METHOD_LABELS[method],
    value: paid.filter(p => p.method === method).reduce((s, p) => s + p.amount, 0),
  })).filter(m => m.value > 0)

  // By membership type
  const membershipMap: Record<string, number> = {}
  paid.forEach(p => {
    const name = (p.membership_type as { name: string } | undefined)?.name ?? 'Drop In / Other'
    membershipMap[name] = (membershipMap[name] ?? 0) + p.amount
  })
  const byMembership = Object.entries(membershipMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const PIE_COLORS = ['#e85d26', '#ff8c5a', '#ffb38a', '#ffd4b8', '#7a2e10']

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: 'var(--text-secondary)' }}>{p.name}: {formatCurrency(p.value)}</div>
        ))}
      </div>
    )
  }

  if (loading) return <Loader />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title="Finance" subtitle={`${now.getFullYear()} overview`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <StatCard label="Month Revenue" value={formatCurrency(monthRevenue)} accent />
        <StatCard label="Month Expenses" value={formatCurrency(monthExpenses)} />
        <StatCard label="Month Profit" value={formatCurrency(monthRevenue - monthExpenses)} accent={monthRevenue > monthExpenses} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} accent={outstanding > 0} />
        {byMethod.map(m => <StatCard key={m.name} label={m.name} value={formatCurrency(m.value)} />)}
      </div>

      {/* Revenue vs Expenses bar chart */}
      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 20 }}>Monthly Revenue vs Expenses</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyData} barGap={4}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" name="Revenue" fill="#e85d26" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="var(--bg-overlay)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Payment methods pie */}
        <Card>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 20 }}>Revenue by Method</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false} fontSize={10}>
                {byMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v as number)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* By membership */}
        <Card>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Revenue by Membership</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byMembership.slice(0, 8).map(({ name, value }) => {
              const max = byMembership[0]?.value ?? 1
              const pct = Math.round((value / max) * 100)
              return (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatCurrency(value)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-overlay)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
