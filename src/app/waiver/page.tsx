'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

export default function WaiverPage() {
  const supabase = createClient()
  const router = useRouter()
  const [waiver, setWaiver] = useState<{ version_number: string; content: string } | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('waiver_versions')
      .select('version_number, content')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setWaiver(data))
  }, [supabase])

  const handleAccept = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      waiver_accepted: true,
      waiver_accepted_at: new Date().toISOString(),
      waiver_version: waiver?.version_number,
    }).eq('id', user!.id)
    router.push('/student/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Liability Waiver</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Please read and accept the waiver before accessing your account
          </p>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {waiver?.content ?? 'Loading waiver…'}
          </p>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                I have read and accept the waiver. I understand this is a legally binding agreement.
              </span>
            </label>

            <Button onClick={handleAccept} disabled={!accepted || saving} style={{ width: '100%' }}>
              {saving ? 'Saving…' : 'Accept & Continue'}
            </Button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Waiver version {waiver?.version_number} · Flowstate Grappling
        </p>
      </div>
    </div>
  )
}
