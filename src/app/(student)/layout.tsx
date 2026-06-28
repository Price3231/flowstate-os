import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()

  const nav = [
    { href: '/student/dashboard', label: 'Dashboard' },
    { href: '/student/timetable', label: 'Book a Class' },
    { href: '/student/bookings', label: 'My Bookings' },
    { href: '/student/profile', label: 'Profile' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>F</div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {nav.map(({ href, label }) => (
              <Link key={href} href={href} style={{ padding: '6px 12px', borderRadius: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{profile?.full_name}</span>
      </header>
      <main style={{ padding: '28px 24px', maxWidth: 900, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
