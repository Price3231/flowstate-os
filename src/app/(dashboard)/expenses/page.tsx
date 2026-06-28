'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SectionHeader, Button, Input, Select, Badge, Table, Th, Td, Modal, FormField, Textarea, Loader, EmptyState, StatCard } from '@/components/ui'
import { formatCurrency, formatDate, EXPENSE_CATEGORY_LABELS } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'
import type { Expense } from '@/types'

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS)

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    category: 'miscellaneous',
    amount: '',
    description: '',
    paid_at: new Date().toISOString().split('T')[0],
  })

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('paid_at', { ascending: false })
    setExpenses(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || e.category === catFilter
    return matchSearch && matchCat
  })

  const thisMonth = new Date()
  const monthTotal = expenses.filter(e => {
    const d = new Date(e.paid_at)
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear()
  }).reduce((s, e) => s + e.amount, 0)

  const byCategory = CATEGORIES.map(([key, label]) => ({
    key,
    label,
    total: expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('expenses').insert({ ...form, amount: parseFloat(form.amount), added_by: user!.id })
    setSaving(false)
    setShowAdd(false)
    setForm({ category: 'miscellaneous', amount: '', description: '', paid_at: new Date().toISOString().split('T')[0] })
    fetchExpenses()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Expenses"
        subtitle={`${formatCurrency(monthTotal)} this month`}
        action={<Button onClick={() => setShowAdd(true)}><Plus size={14} /> Add Expense</Button>}
      />

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {byCategory.map(({ key, label, total }) => (
            <StatCard key={key} label={label} value={formatCurrency(total)} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <Select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width: 180 }}>
          <option value="all">All categories</option>
          {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState message="No expenses found" />
      ) : (
        <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          <Table>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th>Amount</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <Td><span style={{ fontSize: '0.875rem' }}>{e.description}</span></Td>
                  <Td><Badge>{EXPENSE_CATEGORY_LABELS[e.category]}</Badge></Td>
                  <Td><span style={{ fontWeight: 600 }}>{formatCurrency(e.amount)}</span></Td>
                  <Td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(e.paid_at)}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Category">
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </FormField>
          <FormField label="Amount (€)">
            <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
          </FormField>
          <FormField label="Date">
            <Input type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Description">
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What was this for?" />
        </FormField>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.amount || !form.description}>
            {saving ? 'Saving…' : 'Add Expense'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
