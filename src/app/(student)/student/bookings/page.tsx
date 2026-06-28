'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Badge, Loader, EmptyState, Button } from '@/components/ui'
import { formatDate, formatTime, STATUS_COLOURS } from '@/lib/utils'
import Link from 'next/link'

export default function StudentBookingsPage() {
  const supabase = createClient()
  const [bookings, setBookings] = useState<{
    id: string
    status: string
    booked_at: string
    session: { session_date: string; class: { title: string; start_time: string; end_time: string } } | null
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('bookings')
        .select('id, status, booked_at, session:class_sessions(session_date, class:classes(title, start_time, end_time))')
        .eq('user_id', user!.id)
        .order('booked_at', { ascending: false })
      setBookings((data ?? []) as unknown as typeof bookings)
      setLoading(false)
    }
    fetch()
  }, [supabase])

  const today = new Date().toISOString().split('T')[0]

  const upcoming = bookings.filter(b =>
    b.session && b.session.session_date >= today && b.status !== 'cancelled'
  )
  const past = bookings.filter(b =>
    b.session && (b.session.session_date < today || b.status === 'cancelled')
  )

  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Bookings</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px',
              borderRadius: 7,
              fontSize: '0.8rem',
              fontWeight: tab === t ? 600 : 400,
              background: tab === t ? 'var(--bg-surface)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span style={{ marginLeft: 6, fontSize: '0.7rem', opacity: 0.7 }}>
              {t === 'upcoming' ? upcoming.length : past.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? <Loader /> : list.length === 0 ? (
        <EmptyState
          message={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
          action={tab === 'upcoming' ? <Link href="/student/timetable"><Button>Book a class</Button></Link> : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(b => {
            const sess = b.session
            return (
              <Card key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{sess?.class?.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {sess ? formatDate(sess.session_date) : ''} · {sess?.class ? `${formatTime(sess.class.start_time)} – ${formatTime(sess.class.end_time)}` : ''}
                  </div>
                </div>
                <Badge color={STATUS_COLOURS[b.status]}>{b.status}</Badge>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
