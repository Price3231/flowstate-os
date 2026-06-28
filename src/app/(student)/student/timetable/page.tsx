'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, Button, Badge, Loader, EmptyState } from '@/components/ui'
import { DAY_NAMES, formatTime, STATUS_COLOURS } from '@/lib/utils'
import { Users } from 'lucide-react'
import type { ClassSession, Class } from '@/types'

export default function StudentTimetablePage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<(ClassSession & { booking_count: number; user_booking: string | null; class: Class })[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [booking, setBooking] = useState<string | null>(null)

  const today = new Date()
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const { data } = await supabase
      .from('class_sessions')
      .select('*, class:classes(*), bookings(status, user_id)')
      .in('session_date', dates)
      .eq('cancelled', false)
      .order('session_date')

    const enriched = (data ?? []).map(s => ({
      ...s,
      class: (s.class as unknown as Class),
      booking_count: (s.bookings as { status: string }[])?.filter(b => b.status === 'confirmed').length ?? 0,
      user_booking: (s.bookings as { status: string; user_id: string }[])?.find(b => b.user_id === user?.id)?.status ?? null,
    }))

    setSessions(enriched as (ClassSession & { booking_count: number; user_booking: string | null; class: Class })[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const handleBook = async (sessionId: string) => {
    if (!userId) return
    setBooking(sessionId)
    await supabase.from('bookings').insert({ session_id: sessionId, user_id: userId })
    await fetchSessions()
    setBooking(null)
  }

  const handleCancel = async (sessionId: string) => {
    if (!userId) return
    setBooking(sessionId)
    await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('session_id', sessionId).eq('user_id', userId)
    await fetchSessions()
    setBooking(null)
  }

  const grouped = dates.map(date => ({
    date,
    label: new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
    sessions: sessions.filter(s => s.session_date === date),
  })).filter(g => g.sessions.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Book a Class</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Next 7 days</p>
      </div>

      {loading ? <Loader /> : grouped.length === 0 ? (
        <EmptyState message="No classes scheduled for the next 7 days" />
      ) : (
        grouped.map(({ date, label, sessions: daySessions }) => (
          <div key={date}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {daySessions.map(session => {
                const cls = session.class
                const full = session.booking_count >= cls.max_capacity
                const booked = session.user_booking === 'confirmed'
                const waitlisted = session.user_booking === 'waitlisted'
                const isLoading = booking === session.id

                return (
                  <Card key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cls.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                        {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </div>
                      {cls.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>{cls.description}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: full && !booked ? 'var(--accent)' : 'var(--text-muted)' }}>
                        <Users size={13} />
                        {session.booking_count}/{cls.max_capacity}
                      </div>

                      {booked && <Badge color="#22c55e">Booked</Badge>}
                      {waitlisted && <Badge color="#f59e0b">Waitlisted</Badge>}

                      {!booked && !waitlisted && (
                        <Button
                          size="sm"
                          variant={full ? 'outline' : 'primary'}
                          onClick={() => handleBook(session.id)}
                          disabled={!!isLoading}
                        >
                          {isLoading ? '…' : full ? 'Join Waitlist' : 'Book'}
                        </Button>
                      )}

                      {(booked || waitlisted) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(session.id)}
                          disabled={!!isLoading}
                          style={{ color: 'var(--danger)' }}
                        >
                          {isLoading ? '…' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
