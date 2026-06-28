'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SectionHeader, Button, Input, Select, Badge, Table, Th, Td, Modal, FormField, Loader, EmptyState } from '@/components/ui'
import { formatCurrency, formatDate, STATUS_COLOURS, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'
import type { Payment, Profile, MembershipType } from '@/types'

export default function PaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [memberships, setMemberships] = useState<MembershipType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    user_id: '',
    membership_type_id: '',
    amount: '',
    method: 'cash',
    status: 'paid',
    notes: '',
    paid_at: new Date().toISOString().split('T')[0],
  })

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*, user:profiles(full_name, email), membership_type:membership_types(name)')
      .order('created_at', { ascending: false })
    setPayments((data ?? []) as Payment[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchPayments()
    supabase.from('profiles').select('id, full_name, email').eq('role', 'student').then(({ data }) => setMembers((data ?? []) as unknown as Profile[]))
    supabase.from('membership_types').select('*').then(({ data }) => setMemberships(data ?? []))
  }, [fetchPayments, supabase])

  const filtered = payments.filter(p => {
    const user = p.user as { full_name: string; email: string } | undefined
    const matchSearch = user?.full_name.toLowerCase().includes(search.toLowerCase()) || user?.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('payments').insert({
      ...form,
      amount: parseFloat(form.amount),
      membership_type_id: form.membership_type_id || null,
      paid_at: form.status === 'paid' ? new Date(form.paid_at).toISOString() : null,
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ user_id: '', membership_type_id: '', amount: '', method: 'cash', status: 'paid', notes: '', paid_at: new Date().toISOString().split('T')[0] })
    fetchPayments()
  }

  const totalPaid = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const totalPending = filtered.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Payments"
        subtitle={`${formatCurrency(totalPaid)} collected · ${formatCurrency(totalPending)} outstanding`}
        action={<Button onClick={() => setShowAdd(true)}><Plus size={14} /> Log Payment</Button>}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <Input placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState message="No payments found" />
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th>Membership</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const user = p.user as { full_name: string; email: string } | undefined
                const mt = p.membership_type as { name: string } | undefined
                return (
                  <tr key={p.id}>
                    <Td>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{user?.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                    </Td>
                    <Td><span style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</span></Td>
                    <Td><span style={{ fontSize: '0.8rem' }}>{PAYMENT_METHOD_LABELS[p.method]}</span></Td>
                    <Td><Badge color={STATUS_COLOURS[p.status]}>{p.status}</Badge></Td>
                    <Td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{mt?.name ?? '—'}</span></Td>
                    <Td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.paid_at ? formatDate(p.paid_at) : '—'}</span></Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Log Payment">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Member">
            <Select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
              <option value="">Select member</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </Select>
          </FormField>
          <FormField label="Amount (€)">
            <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="79.00" min="0" step="0.01" />
          </FormField>
          <FormField label="Membership">
            <Select value={form.membership_type_id} onChange={e => setForm(f => ({ ...f, membership_type_id: e.target.value }))}>
              <option value="">—</option>
              {memberships.map(mt => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Method">
            <Select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
              <option value="cash">Cash</option>
              <option value="revolut">Revolut</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="stripe">Stripe</option>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </Select>
          </FormField>
          <FormField label="Date">
            <Input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Notes">
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
        </FormField>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.user_id || !form.amount}>
            {saving ? 'Saving…' : 'Log Payment'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
