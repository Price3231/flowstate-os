'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SectionHeader, Button, Card, Badge, Modal, FormField, Input, Textarea, Loader, EmptyState } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Send, Mail, AlertTriangle, Pencil } from 'lucide-react'

interface AtRiskMember {
  id: string
  full_name: string
  email: string
  last_attendance: string | null
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  trigger: string
}

export default function AutomationsPage() {
  const supabase = createClient()
  const [atRisk, setAtRisk] = useState<AtRiskMember[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [showTemplate, setShowTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [sending, setSending] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', trigger: 'at_risk' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: risk }, { data: tmpl }] = await Promise.all([
      supabase.from('at_risk_members').select('id, full_name, email, last_attendance'),
      supabase.from('email_templates').select('*').order('created_at'),
    ])
    setAtRisk((risk ?? []) as AtRiskMember[])
    setTemplates((tmpl ?? []) as EmailTemplate[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSelect = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const selectAll = () =>
    setSelected(atRisk.length === selected.length ? [] : atRisk.map(m => m.id))

  const sendEmails = async () => {
    setSending(true)
    const atRiskTemplate = templates.find(t => t.trigger === 'at_risk')
    if (!atRiskTemplate) { setSending(false); return }

    const targets = atRisk.filter(m => selected.includes(m.id))
    await fetch('/api/automations/send-at-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: targets, template: atRiskTemplate }),
    })
    setSending(false)
    setSelected([])
    alert(`Emails sent to ${targets.length} member(s)`)
  }

  const saveTemplate = async () => {
    if (editingTemplate) {
      await supabase.from('email_templates').update(templateForm).eq('id', editingTemplate.id)
    } else {
      await supabase.from('email_templates').insert(templateForm)
    }
    setShowTemplate(false)
    setEditingTemplate(null)
    setTemplateForm({ name: '', subject: '', body: '', trigger: 'at_risk' })
    fetchData()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader title="Automations" subtitle="At-risk member outreach and email workflows" />

      {/* At Risk */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>At Risk Members</h2>
            <Badge color="#e85d26">{atRisk.length}</Badge>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {atRisk.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selected.length === atRisk.length ? 'Deselect all' : 'Select all'}
              </Button>
            )}
            {selected.length > 0 && (
              <Button size="sm" onClick={sendEmails} disabled={sending}>
                <Send size={12} /> {sending ? 'Sending…' : `Send email (${selected.length})`}
              </Button>
            )}
          </div>
        </div>

        {loading ? <Loader /> : atRisk.length === 0 ? (
          <EmptyState message="No at-risk members — everyone is training! 🏆" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {atRisk.map((m) => (
              <div
                key={m.id}
                onClick={() => toggleSelect(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: selected.includes(m.id) ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  border: `1px solid ${selected.includes(m.id) ? 'var(--accent-muted)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" checked={selected.includes(m.id)} onChange={() => {}} style={{ accentColor: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{m.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.email}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {m.last_attendance ? `Last: ${formatDate(m.last_attendance)}` : 'Never attended'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Email Templates */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Email Templates</h2>
          </div>
          <Button size="sm" onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', subject: '', body: '', trigger: 'at_risk' }); setShowTemplate(true) }}>
            + New Template
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Subject: {t.subject}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge>{t.trigger.replace('_', ' ')}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(t)
                    setTemplateForm({ name: t.name, subject: t.subject, body: t.body, trigger: t.trigger })
                    setShowTemplate(true)
                  }}
                >
                  <Pencil size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Template Editor */}
      <Modal open={showTemplate} onClose={() => setShowTemplate(false)} title={editingTemplate ? 'Edit Template' : 'New Template'} width="max-w-2xl">
        <FormField label="Template Name">
          <Input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="At Risk Check-in" />
        </FormField>
        <FormField label="Trigger">
          <select
            value={templateForm.trigger}
            onChange={e => setTemplateForm(f => ({ ...f, trigger: e.target.value }))}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: '0.875rem' }}
          >
            <option value="at_risk">At Risk</option>
            <option value="welcome">Welcome</option>
            <option value="payment_reminder">Payment Reminder</option>
            <option value="custom">Custom</option>
          </select>
        </FormField>
        <FormField label="Subject Line">
          <Input value={templateForm.subject} onChange={e => setTemplateForm(f => ({ ...f, subject: e.target.value }))} placeholder="We miss you at Flowstate!" />
        </FormField>
        <FormField label="Body (HTML supported · Use {{name}} for member name)">
          <Textarea value={templateForm.body} onChange={e => setTemplateForm(f => ({ ...f, body: e.target.value }))} rows={8} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
        </FormField>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={() => setShowTemplate(false)}>Cancel</Button>
          <Button onClick={saveTemplate} disabled={!templateForm.name || !templateForm.subject}>
            {editingTemplate ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
