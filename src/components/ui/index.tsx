'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

// ── Card ──────────────────────────────────────────────────────
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border p-5', className)}
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        {Icon && (
          <Icon
            size={16}
            className={accent ? 'text-accent' : 'text-muted'}
          />
        )}
      </div>
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 600,
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>
      )}
    </Card>
  )
}

// ── Button ────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

    const variants = {
      primary: 'text-white',
      ghost: 'hover:opacity-80',
      danger: 'text-white',
      outline: '',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-sm',
    }

    const styles: React.CSSProperties =
      variant === 'primary'
        ? { background: 'var(--accent)', color: '#fff' }
        : variant === 'ghost'
        ? { background: 'transparent', color: 'var(--text-secondary)' }
        : variant === 'danger'
        ? { background: 'var(--danger)', color: '#fff' }
        : { border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        style={styles}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ── Badge ─────────────────────────────────────────────────────
export function Badge({
  children,
  color,
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: color ? `${color}20` : 'var(--bg-overlay)',
        color: color ?? 'var(--text-secondary)',
        border: `1px solid ${color ? `${color}40` : 'var(--border)'}`,
      }}
    >
      {children}
    </span>
  )
}

// ── Input ─────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('w-full rounded-lg px-3 py-2 text-sm outline-none transition-all', className)}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
      {...props}
    />
  )
)
Input.displayName = 'Input'

// ── Select ────────────────────────────────────────────────────
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('w-full rounded-lg px-3 py-2 text-sm outline-none cursor-pointer', className)}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

// ── Textarea ──────────────────────────────────────────────────
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn('w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-all', className)}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

// ── Label ─────────────────────────────────────────────────────
export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}
    >
      {children}
    </label>
  )
}

// ── FormField ─────────────────────────────────────────────────
export function FormField({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-2xl p-6 flex flex-col gap-5`}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        {children}
      </table>
    </div>
  )
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={className}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td
      className={className}
      style={{
        padding: '12px',
        borderBottom: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </td>
  )
}

// ── Empty state ───────────────────────────────────────────────
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div style={{ fontSize: '2rem' }}>🥋</div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{message}</p>
      {action}
    </div>
  )
}

// ── Loader ────────────────────────────────────────────────────
export function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        style={{
          width: 28,
          height: 28,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
