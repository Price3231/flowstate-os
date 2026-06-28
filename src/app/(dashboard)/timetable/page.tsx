'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SectionHeader, Button, Card, Modal, FormField, Input, Select, Badge, Loader, EmptyState } from '@/components/ui'
import { Plus, Users, Clock } from 'lucide-react'
import { DAY_NAMES, formatTime, STATUS_COLOURS } from '@/lib/utils'
import type { Class, ClassSession, Booking } from '@/types'

export default function TimetablePage() {
  const supabase = createClient()
  const [classes, setClasses] = useState<Class[]>([])
  const [sessions, setSessions] = useState<(ClassSession & { booking_count: number; waitlist_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddClass, setShowAddClass] = useState(false)
  const [showSession, setShowSession] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [sessionBookings, setSessionBookings] = useState<(Booking & { user: { full_name: string; email: string } })[]>([])
  const [saving, setSaving] = useState(false)

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())

  const [classForm, setClassForm] = useState({
    title: '',
    description: '',
    day_of_week: 1,
    start_time: '18:00',
    end_time: '19:30',
    max_capacity: 15,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: classData } = await supabase.from('classes').select('*').eq('is_active', true).order('day_of_week').order('start_time')

    // Get sessions for next 7 days
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d.toISOString().split('T')[0]
    })

    const { data: sessionData } = await supabase
      .from('class_sessions')
      .select('*, class:classes(*), bookings(status)')
      .in('session_date', dates)
      .eq('cancelled', false)

    const enriched = (sessionData ?? []).map((s) => ({
      ...s,
      booking_count: (s.bookings as {status: string}[])?.filter(b => b.status === 'confirmed').length ?? 0,
      waitlist_count: (s.bookings as {status: string}[])?.filter(b => b.status === 'waitlisted').length ?? 0,
    }))

    setClasses(classData ?? [])
    setSessions(enriched as (ClassSession & { booking_count: number; waitlist_count: number })[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const openSession = async (sessionId: string) => {
    setSelectedSession(sessionId)
    const { data } = await supabase
      .from('bookings')
      .select('*, user:profiles(full_name, email)')
      .eq('session_id', sessionId)
      .order('booked_at')
    setSessionBookings((data ?? []) as (Booking & { user: { full_name: string; email: string } })[])
    setShowSession(true)
  }

  const saveClass = async () => {
    setSaving(true)
    await supabase.from('classes').insert(classForm)
    setSaving(false)
    setShowAddClass(false)
    setClassForm({ title: '', description: '', day_of_week: 1, start_time: '18:00', end_time: '19:30', max_capacity: 15 })
    fetchData()
  }

  const generateSessions = async () => {
    // Generate sessions for the next 4 weeks for all active classes
    const inserts: { class_id: string; session_date: string }[] = []
    for (let week = 0; week < 4; week++) {
      for (const cls of classes) {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + (cls.day_of_week - weekStart.getDay() + 7) % 7 + week * 7)
        inserts.push({ class_id: cls.id, session_date: d.toISOString().split('T')[0] })
      }
    }
    await supabase.from('class_sessions').upsert(inserts, { onConflict: 'class_id,session_date' })
    fetchData()
  }

  const dayGroups = DAY_NAMES.map((day, idx) => ({
    day,
    idx,
    classes: classes.filter(c => c.day_of_week === idx),
    date: (() => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + idx)
      return d
    })(),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        title="Timetable"
        subtitle="Weekly recurring schedule"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={generateSessions}>Generate Sessions</Button>
            <Button onClick={() => setShowAddClass(true)}><Plus size={14} /> Add Class</Button>
          </div>
        }
      />

      {loading ? <Loader /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
          {dayGroups.map(({ day, idx, classes: dayClasses, date }) => {
            const isToday = date.toDateString() === new Date().toDateString()
            const dateStr = date.toISOString().split('T')[0]
            const daySessions = sessions.filter(s => {
              const cls = s.class as Class | null
              return s.session_date === dateStr && cls?.day_of_week === idx
            })

            return (
              <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: isToday ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  border: isToday ? '1px solid var(--accent-muted)' : '1px solid transparent',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {day.slice(0, 3)}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {date.getDate()}
                  </div>
                </div>

                {dayClasses.length === 0 && (
                  <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Rest</span>
                  </div>
                )}

                {dayClasses.map(cls => {
                  const sessionForDay = daySessions.find(s => {
                    const sc = s.class as Class | null
                    return sc?.id === cls.id
                  })
                  const booked = sessionForDay?.booking_count ?? 0
                  const waitlist = sessionForDay?.waitlist_count ?? 0
                  const full = booked >= cls.max_capacity
                  return (
                    <button
                      key={cls.id}
                      onClick={() => sessionForDay && openSession(sessionForDay.id)}
                      style={{
                        padding: '10px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        border: `1px solid ${full ? 'var(--accent-muted)' : 'var(--border)'}`,
                        cursor: sessionForDay ? 'pointer' : 'default',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {cls.title}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                        {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                      </div>
                      {sessionForDay ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={10} style={{ color: full ? 'var(--accent)' : 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.65rem', color: full ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {booked}/{cls.max_capacity}
                            {waitlist > 0 && ` +${waitlist}`}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No session</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Recurring Classes list */}
      <Card>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16 }}>Recurring Classes</h2>
        {classes.length === 0 ? (
          <EmptyState message="No classes yet" action={<Button onClick={() => setShowAddClass(true)}>Add first class</Button>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {classes.map((cls) => (
              <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)' }}>
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{cls.title}</span>
                  <span style={{ marginLeft: 10, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {DAY_NAMES[cls.day_of_week]} · {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max {cls.max_capacity}</span>
                  <Badge color="#22c55e">Active</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Class Modal */}
      <Modal open={showAddClass} onClose={() => setShowAddClass(false)} title="Add Class">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Title">
            <Input value={classForm.title} onChange={e => setClassForm(f => ({ ...f, title: e.target.value }))} placeholder="No-Gi Fundamentals" />
          </FormField>
          <FormField label="Day">
            <Select value={classForm.day_of_week} onChange={e => setClassForm(f => ({ ...f, day_of_week: +e.target.value }))}>
              {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </FormField>
          <FormField label="Start Time">
            <Input type="time" value={classForm.start_time} onChange={e => setClassForm(f => ({ ...f, start_time: e.target.value }))} />
          </FormField>
          <FormField label="End Time">
            <Input type="time" value={classForm.end_time} onChange={e => setClassForm(f => ({ ...f, end_time: e.target.value }))} />
          </FormField>
          <FormField label="Max Capacity">
            <Input type="number" value={classForm.max_capacity} onChange={e => setClassForm(f => ({ ...f, max_capacity: +e.target.value }))} min={1} max={50} />
          </FormField>
          <FormField label="Description">
            <Input value={classForm.description} onChange={e => setClassForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </FormField>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={() => setShowAddClass(false)}>Cancel</Button>
          <Button onClick={saveClass} disabled={saving || !classForm.title}>
            {saving ? 'Saving…' : 'Add Class'}
          </Button>
        </div>
      </Modal>

      {/* Session Detail Modal */}
      <Modal open={showSession} onClose={() => setShowSession(false)} title="Session Bookings" width="max-w-xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
          {sessionBookings.length === 0 ? (
            <EmptyState message="No bookings for this session" />
          ) : (
            sessionBookings.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{b.user?.full_name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.user?.email}</div>
                </div>
                <Badge color={STATUS_COLOURS[b.status]}>{b.status}</Badge>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
