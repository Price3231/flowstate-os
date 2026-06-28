'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Button, Input, FormField, Badge, Loader } from '@/components/ui'
import { formatDate, STATUS_COLOURS } from '@/lib/utils'

export default function StudentProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<{
    full_name: string; email: string; phone: string;
    emergency_contact_name: string; emergency_contact_phone: string;
    status: string; membership_type: { name: string; price: number } | null;
    membership_start_date: string | null; membership_renewal_date: string | null;
    waiver_accepted: boolean; waiver_accepted_at: string | null;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ phone: '', emergency_contact_name: '', emergency_contact_phone: '' })

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone, emergency_contact_name, emergency_contact_phone, status, membership_type:membership_types(name, price), membership_start_date, membership_renewal_date, waiver_accepted, waiver_accepted_at')
        .eq('id', user!.id)
        .single()
      if (data) {
        setProfile(data as unknown as typeof profile)
        setForm({
          phone: data.phone ?? '',
          emergency_contact_name: data.emergency_contact_name ?? '',
          emergency_contact_phone: data.emergency_contact_phone ?? '',
        })
      }
      setLoading(false)
    }
    fetch()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update(form).eq('id', user!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Loader />

  const mt = profile?.membership_type as { name: string; price: number } | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Profile</h1>

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Membership</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Status', value: <Badge color={STATUS_COLOURS[profile?.status ?? 'trial']}>{profile?.status}</Badge> },
            { label: 'Plan', value: mt?.name ?? '—' },
            { label: 'Start Date', value: profile?.membership_start_date ? formatDate(profile.membership_start_date) : '—' },
            { label: 'Renewal Date', value: profile?.membership_renewal_date ? formatDate(profile.membership_renewal_date) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Personal Details</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Name</div>
            <div style={{ fontSize: '0.875rem' }}>{profile?.full_name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: '0.875rem' }}>{profile?.email}</div>
          </div>
          <FormField label="Phone">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+356 9999 0000" />
          </FormField>
          <FormField label="Emergency Contact Name">
            <Input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
          </FormField>
          <FormField label="Emergency Contact Phone">
            <Input value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
          </FormField>
          <Button onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>Waiver</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge color={profile?.waiver_accepted ? '#22c55e' : '#ef4444'}>
            {profile?.waiver_accepted ? 'Accepted' : 'Not accepted'}
          </Badge>
          {profile?.waiver_accepted_at && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              on {formatDate(profile.waiver_accepted_at)}
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}
