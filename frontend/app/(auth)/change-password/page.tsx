'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, KeyRound } from 'lucide-react'
import api from '@/lib/api'
import { persistAuthTokens, decodeJwt } from '@/lib/auth'
import { Logo } from '@/components/shared'
import { Field } from '@/components/auth/Field'
import type { AuthTokens } from '@/lib/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path:    ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangePasswordPage() {
  const router = useRouter()
  const [serverError, setServerError]   = useState<string | null>(null)
  const [successMessage, setSuccess]    = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    setSuccess(null)
    try {
      const { data: tokens } = await api.post<AuthTokens>('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      })

      // Refresh tokens were revoked server-side; persist the freshly issued pair
      // and clear the must-change cookie so the proxy stops trapping us here.
      persistAuthTokens(tokens.accessToken, tokens.refreshToken, false, tokens.user)

      const role = decodeJwt(tokens.accessToken)?.role
      setSuccess('Password updated. Redirecting…')
      setTimeout(() => {
        router.push(role === 'DEVELOPER' ? '/me' : '/dashboard')
      }, 800)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to update password. Check your current password and try again.'
      setServerError(msg)
    }
  }


  return (
    <div className="w-full max-w-sm">
      {/* Wordmark */}
      <div className="mb-8 flex justify-center">
        <Logo size={28} />
      </div>

      {/* Card */}
      <div
        className="rounded border p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            <KeyRound size={16} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Set your password to continue
            </p>
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Your manager shared a temporary password with you. Set a new one before continuing.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="currentPassword"
            label="Temporary password"
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

          {serverError && (
            <p
              className="rounded border px-3 py-2 text-sm"
              style={{
                color:       'var(--danger)',
                borderColor: 'rgba(220,38,38,0.2)',
                background:  'rgba(220,38,38,0.08)',
              }}
            >
              {serverError}
            </p>
          )}

          {successMessage && (
            <p
              className="rounded border px-3 py-2 text-sm"
              style={{
                color:       'var(--success)',
                borderColor: 'rgba(22,163,74,0.2)',
                background:  'rgba(22,163,74,0.08)',
              }}
            >
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-9 w-full items-center justify-center gap-2 rounded text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Set new password
          </button>
        </form>
      </div>
    </div>
  )
}
