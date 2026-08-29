'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/shared'
import api from '@/lib/api'
import { persistAuthTokens } from '@/lib/auth'
import type { AuthTokens } from '@/lib/types'

// ─── Reusable field ───────────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?:  string
  error?: string
}

function Field({ label, hint, error, id, disabled, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <input
        id={id}
        disabled={disabled}
        className="w-full rounded border px-3 text-sm outline-none transition-colors duration-150 disabled:cursor-not-allowed"
        style={{
          height:      '36px',
          background:  disabled ? 'var(--surface)' : 'var(--surface-2)',
          color:       disabled ? 'var(--text-faint)' : 'var(--text)',
          borderColor: error ? 'var(--danger)' : 'var(--border)',
          opacity:     disabled ? 0.7 : 1,
        }}
        onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)' }}
        onBlur={(e)  => { if (!disabled) e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)' }}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface SectionProps {
  title:    string
  subtitle: string
  children: React.ReactNode
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <section
      className="rounded border p-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-5">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

// ─── Inline status ────────────────────────────────────────────────────────────

function StatusBanner({ kind, message }: { kind: 'success' | 'error'; message: string }) {
  const styles = kind === 'success'
    ? { color: 'var(--success)', borderColor: 'rgba(22,163,74,0.2)',  background: 'rgba(22,163,74,0.08)'  }
    : { color: 'var(--danger)',  borderColor: 'rgba(220,38,38,0.2)',  background: 'rgba(220,38,38,0.08)' }
  return (
    <p className="rounded border px-3 py-2 text-xs" style={styles}>
      {message}
    </p>
  )
}

// ─── Profile form ─────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'Name is too long'),
})
type ProfileForm = z.infer<typeof profileSchema>

interface ProfileSectionProps {
  initialName:  string
  initialEmail: string
}

function ProfileSection({ initialName, initialEmail }: ProfileSectionProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver:      zodResolver(profileSchema),
    defaultValues: { name: initialName },
  })

  async function onSubmit(data: ProfileForm) {
    setServerError(null)
    setSuccess(null)
    try {
      await api.patch('/developer/me', { name: data.name })
      setSuccess('Saved!')
      // Update sessionStorage user info so the topnav reflects the new name
      try {
        const stored = sessionStorage.getItem('ds_user')
        if (stored) {
          const u = JSON.parse(stored)
          sessionStorage.setItem('ds_user', JSON.stringify({ ...u, name: data.name }))
        }
      } catch { /* ignore */ }
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to update profile.'
      setServerError(msg)
    }
  }

  return (
    <Section title="Profile" subtitle="Your display name and account email.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="name"
          label="Display name"
          placeholder="Your name"
          error={errors.name?.message}
          {...register('name')}
        />

        <Field
          id="email"
          label="Email"
          type="email"
          value={initialEmail}
          disabled
          readOnly
          hint="Contact your lead to change your email."
        />

        {serverError && <StatusBanner kind="error"   message={serverError} />}
        {success     && <StatusBanner kind="success" message={success}     />}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="flex h-9 items-center gap-2 rounded px-4 text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { if (!isSubmitting && isDirty) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </form>
    </Section>
  )
}

// ─── Password form ────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  })
type PasswordForm = z.infer<typeof passwordSchema>

function PasswordSection() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  async function onSubmit(data: PasswordForm) {
    setServerError(null)
    setSuccess(null)
    try {
      const { data: tokens } = await api.post<AuthTokens>('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      })
      // The server revoked the old refresh tokens and issued a new pair;
      // persist them so subsequent requests don't 401 once the old access token expires.
      persistAuthTokens(tokens.accessToken, false, tokens.user)
      setSuccess('Password updated.')
      reset()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to update password. Check your current password and try again.'
      setServerError(msg)
    }
  }

  return (
    <Section title="Change password" subtitle="Use a strong password you do not reuse elsewhere.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Field
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Field
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && <StatusBanner kind="error"   message={serverError} />}
        {success     && <StatusBanner kind="success" message={success}     />}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-9 items-center gap-2 rounded px-4 text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            Update password
          </button>
        </div>
      </form>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SettingsUser {
  name:  string
  email: string
}

export default function MySettingsPage() {
  const [user, setUser] = useState<SettingsUser | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('ds_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<SettingsUser>
        setUser({ name: parsed.name ?? '', email: parsed.email ?? '' })
        return
      } catch { /* ignore */ }
    }
    setUser({ name: '', email: '' })
  }, [])

  if (!user) {
    return (
      <div className="space-y-6">
        <div
          className="h-12 w-48 animate-pulse rounded"
          style={{ background: 'var(--surface)' }}
        />
        <div
          className="h-64 animate-pulse rounded border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and password."
      />
      <ProfileSection initialName={user.name} initialEmail={user.email} />
      <PasswordSection />
    </div>
  )
}
