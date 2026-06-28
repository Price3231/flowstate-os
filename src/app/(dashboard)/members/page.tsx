'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  SectionHeader,
  Button,
  Input,
  Select,
  Badge,
  Table,
  Th,
  Td,
  Modal,
  FormField,
  Textarea,
  Loader,
  EmptyState,
} from '@/components/ui'
import { formatDate, formatCurrency, STATUS_COLOURS, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { Search, Plus, Pencil, Eye } from 'lucide-react'
import type { Profile, MembershipType } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  frozen: 'Frozen',
  cancelled: 'Cancelled',
  trial: 'Trial',
}

export default function MembersPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<Profile[]>([])
  const [memberships, setMemberships] = useState<MembershipType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    status: 'trial',
    role: 'student',
    membership_type_id: '',
    membership_start_date: '',
    membership_renewal_date: '',
    payment_method: '',
    deposit_paid: false,
    notes: '',
  })

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, membership_type:membership_types(*)')
      .order('created_at', { ascending: false })
    setMembers((data ?? []) as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchMembers()
    supabase.from('membership_types').select('*').then(({ data }) => setMemberships(data ?? []))
  }, [fetchMembers, supabase])

  const filtered = members.filter((m) => {
    const matchSearch =
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.phone?.includes(search)
    const matchStatus = statusFilter === 'all' || m.status === statusFilter
    return matchSearch && matchStatus
  })

  const openEdit = (m: Profile) => {
    setEditing(m)
    setForm({
      full_name: m.full_name,
      email: m.email,
      phone: m.phone ?? '',
      emergency_contact_name: m.emergency_contact_name ?? '',
      emergency_contact_phone: m.emergency_contact_phone ?? '',
      status: m.status,
      role: m.role,
      membership_type_id: m.membership_type_id ?? '',
      membership_start_date: m.membership_start_date ?? '',
      membership_renewal_date: m.membership_renewal_date ?? '',
      payment_method: m.payment_method ?? '',
      deposit_paid: m.deposit_paid,
      notes: m.notes ?? '',
    })
    setShowAdd(true)
  }

  const resetForm = () => {
    setEditing(null)
    setForm({
      full_name: '',
      email: '',
      phone: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      status: 'trial',
      role: 'student',
      membership_type_id: '',
      membership_start_date: '',
      membership_renewal_date: '',
      payment_method: '',
      deposit_paid: false,
      notes: '',
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...form,
      membership_type_id: form.membership_type_id || null,
      payment_method: form.payment_method || null,
    }

    if (editing) {
      await supabase.from('profiles').update(payload).eq('id', editing.id)
    } else {
      // For new members, admin creates via Supabase Auth invite or direct insert
      await supabase.from('profiles').insert(payload)
    }

    setSaving(false)
    setShowAdd(false)
    resetForm()
    fetchMembers()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Members"
        subtitle={`${members.filter(m => m.status === 'active').length} active · ${members.filter(m => m.status === 'trial').length} trial`}
        action={
          <Button onClick={() => { resetForm(); setShowAdd(true) }}>
            <Plus size={14} /> Add Member
          </Button>
        }
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 140 }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="frozen">Frozen</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState message="No members found" action={<Button onClick={() => { resetForm(); setShowAdd(true) }}>Add first member</Button>} />
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Membership</Th>
                <Th>Joined</Th>
                <Th>Renewal</Th>
                <Th>Deposit</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} style={{ transition: 'background 0.1s' }}>
                  <Td>
                    <div style={{ fontWeight: 500 }}>{m.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.email}</div>
                  </Td>
                  <Td>
                    <Badge color={STATUS_COLOURS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
                  </Td>
                  <Td>
                    <span style={{ fontSize: '0.8rem' }}>
                      {m.membership_type?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </span>
                  </Td>
                  <Td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(m.created_at)}</span></Td>
                  <Td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {m.membership_renewal_date ? formatDate(m.membership_renewal_date) : '—'}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={m.deposit_paid ? '#22c55e' : '#ef4444'}>
                      {m.deposit_paid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                        <Pencil size={12} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); resetForm() }}
        title={editing ? 'Edit Member' : 'Add Member'}
        width="max-w-2xl"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Full Name">
            <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Doe" />
          </FormField>
          <FormField label="Email">
            <Input value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@email.com" />
          </FormField>
          <FormField label="Phone">
            <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+356 9999 0000" />
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </FormField>
          <FormField label="Membership">
            <Select value={form.membership_type_id} onChange={(e) => setForm(f => ({ ...f, membership_type_id: e.target.value }))}>
              <option value="">No membership</option>
              {memberships.map((mt) => (
                <option key={mt.id} value={mt.id}>{mt.name} — {formatCurrency(mt.price)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Payment Method">
            <Select value={form.payment_method} onChange={(e) => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="">Select method</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Cash</option>
              <option value="revolut">Revolut</option>
              <option value="bank_transfer">Bank Transfer</option>
            </Select>
          </FormField>
          <FormField label="Start Date">
            <Input type="date" value={form.membership_start_date} onChange={(e) => setForm(f => ({ ...f, membership_start_date: e.target.value }))} />
          </FormField>
          <FormField label="Renewal Date">
            <Input type="date" value={form.membership_renewal_date} onChange={(e) => setForm(f => ({ ...f, membership_renewal_date: e.target.value }))} />
          </FormField>
          <FormField label="Emergency Contact Name">
            <Input value={form.emergency_contact_name} onChange={(e) => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
          </FormField>
          <FormField label="Emergency Contact Phone">
            <Input value={form.emergency_contact_phone} onChange={(e) => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
          </FormField>
        </div>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
        </FormField>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="deposit"
            checked={form.deposit_paid}
            onChange={(e) => setForm(f => ({ ...f, deposit_paid: e.target.checked }))}
            style={{ accentColor: 'var(--accent)' }}
          />
          <label htmlFor="deposit" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Deposit paid
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
