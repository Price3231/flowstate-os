'use client'

import { SectionHeader, Card, Button, Input, FormField, Textarea } from '@/components/ui'
import { useState } from 'react'

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')
  const [settings, setSettings] = useState({
    academy_name: 'Flowstate Grappling',
    contact_email: 'info@flowstategrappling.com',
    at_risk_days: '14',
    auto_email_enabled: false,
    max_class_size: '15',
    currency: 'EUR',
  })

  const handleSave = async () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult('')
    try {
      const res = await fetch('/api/sheets/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data.success ? `✓ Synced at ${new Date(data.timestamp).toLocaleTimeString()}` : `Error: ${data.error}`)
    } catch {
      setSyncResult('Sync failed — check your Google credentials')
    }
    setSyncing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}>
      <SectionHeader title="Settings" subtitle="Academy configuration" />

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>General</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="Academy Name">
            <Input value={settings.academy_name} onChange={e => setSettings(s => ({ ...s, academy_name: e.target.value }))} />
          </FormField>
          <FormField label="Contact Email">
            <Input type="email" value={settings.contact_email} onChange={e => setSettings(s => ({ ...s, contact_email: e.target.value }))} />
          </FormField>
          <FormField label="Default Max Class Size">
            <Input type="number" value={settings.max_class_size} onChange={e => setSettings(s => ({ ...s, max_class_size: e.target.value }))} min="1" />
          </FormField>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Automations</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="At-Risk Threshold (days without attendance)">
            <Input type="number" value={settings.at_risk_days} onChange={e => setSettings(s => ({ ...s, at_risk_days: e.target.value }))} min="1" />
          </FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.auto_email_enabled}
              onChange={e => setSettings(s => ({ ...s, auto_email_enabled: e.target.checked }))}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Automatically send at-risk emails
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>Google Sheets Sync</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          Push all data (members, payments, attendance, expenses) to your connected Google Sheet.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? 'Syncing…' : '↑ Sync to Google Sheets'}
          </Button>
          {syncResult && (
            <span style={{ fontSize: '0.8rem', color: syncResult.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
              {syncResult}
            </span>
          )}
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>Environment Variables</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Configure these in your <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: '0.75rem' }}>.env.local</code> file:
        </p>
        {[
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY',
          'STRIPE_SECRET_KEY',
          'STRIPE_WEBHOOK_SECRET',
          'GOOGLE_SHEETS_ID',
          'RESEND_API_KEY',
        ].map(key => (
          <div key={key} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 4, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            {key}
          </div>
        ))}
      </Card>

      <Button onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </Button>
    </div>
  )
}
