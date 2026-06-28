'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SectionHeader, Button, Card, Select, StatCard } from '@/components/ui'
import { formatCurrency, formatDate, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { Download, FileText } from 'lucide-react'

type ReportType = 'revenue' | 'expenses' | 'attendance' | 'members'

export default function ReportsPage() {
  const supabase = createClient()
  const [reportType, setReportType] = useState<ReportType>('revenue')
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generateReport = async () => {
    setLoading(true)
    setGenerated(false)
    let result: Record<string, unknown>[] = []

    if (reportType === 'revenue') {
      const { data: payments } = await supabase
        .from('payments')
        .select('*, user:profiles(full_name, email), membership_type:membership_types(name)')
        .eq('status', 'paid')
        .gte('paid_at', startDate)
        .lte('paid_at', endDate + 'T23:59:59')
        .order('paid_at', { ascending: false })
      result = (payments ?? []).map(p => ({
        Date: formatDate(p.paid_at),
        Member: (p.user as {full_name: string})?.full_name,
        Email: (p.user as {email: string})?.email,
        Membership: (p.membership_type as {name: string})?.name ?? 'Other',
        Method: p.method,
        Amount: `€${p.amount}`,
      }))
    } else if (reportType === 'expenses') {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('paid_at', startDate)
        .lte('paid_at', endDate)
        .order('paid_at', { ascending: false })
      result = (expenses ?? []).map(e => ({
        Date: formatDate(e.paid_at),
        Category: EXPENSE_CATEGORY_LABELS[e.category],
        Description: e.description,
        Amount: `€${e.amount}`,
      }))
    } else if (reportType === 'attendance') {
      const { data: att } = await supabase
        .from('attendance')
        .select('*, user:profiles(full_name, email), session:class_sessions(session_date, class:classes(title))')
        .eq('attended', true)
        .gte('marked_at', startDate)
        .lte('marked_at', endDate + 'T23:59:59')
        .order('marked_at', { ascending: false })
      result = (att ?? []).map(a => ({
        Date: (a.session as {session_date: string})?.session_date,
        Class: ((a.session as {class: {title: string}})?.class)?.title,
        Member: (a.user as {full_name: string})?.full_name,
        Email: (a.user as {email: string})?.email,
      }))
    } else if (reportType === 'members') {
      const { data: members } = await supabase
        .from('profiles')
        .select('*, membership_type:membership_types(name)')
        .eq('role', 'student')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false })
      result = (members ?? []).map(m => ({
        Name: m.full_name,
        Email: m.email,
        Phone: m.phone ?? '—',
        Status: m.status,
        Membership: (m.membership_type as {name: string})?.name ?? '—',
        Joined: formatDate(m.created_at),
        'Renewal Date': m.membership_renewal_date ? formatDate(m.membership_renewal_date) : '—',
        'Deposit Paid': m.deposit_paid ? 'Yes' : 'No',
      }))
    }

    setData(result)
    setGenerated(true)
    setLoading(false)
  }

  const exportCSV = () => {
    if (!data.length) return
    const headers = Object.keys(data[0])
    const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flowstate-${reportType}-${startDate}.csv`
    a.click()
  }

  const totalAmount = reportType === 'revenue' || reportType === 'expenses'
    ? data.reduce((s, row) => s + parseFloat(String(row.Amount).replace('€', '') || '0'), 0)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title="Reports" subtitle="Generate and export data" />

      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Report Type</label>
            <Select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} style={{ width: 180 }}>
              <option value="revenue">Revenue</option>
              <option value="expenses">Expenses</option>
              <option value="attendance">Attendance</option>
              <option value="members">Members</option>
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem' }} />
          </div>
          <Button onClick={generateReport} disabled={loading}>
            <FileText size={14} /> {loading ? 'Generating…' : 'Generate'}
          </Button>
          {generated && data.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download size={14} /> Export CSV
            </Button>
          )}
        </div>
      </Card>

      {generated && (
        <>
          {totalAmount !== null && (
            <div style={{ display: 'flex', gap: 12 }}>
              <StatCard label="Total Records" value={data.length} />
              <StatCard label="Total Amount" value={formatCurrency(totalAmount)} accent />
            </div>
          )}

          {data.length > 0 ? (
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-surface)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    {Object.keys(data[0]).map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Card>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>No data found for selected period</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
