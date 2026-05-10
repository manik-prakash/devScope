'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { persistAuthTokens, decodeJwt } from '@/lib/auth'
import { Logo } from '@/components/shared'
import type { AuthTokens } from '@/lib/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

// ─── Reusable field ───────────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

function Field({ label, error, id, ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded border px-3 text-sm outline-none transition-colors duration-150"
        style={{
          height:      '36px',
          background:  'var(--surface-2)',
          color:       'var(--text)',
          borderColor: error ? 'var(--danger)' : 'var(--border)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--accent)' }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--border)' }}
        {...props}
      />
      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Form (needs Suspense because of useSearchParams) ─────────────────────────

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const { data: tokens } = await api.post<AuthTokens>('/auth/login', {
        email:    data.email,
        password: data.password,
      })

      persistAuthTokens(tokens.accessToken, tokens.refreshToken)

      const payload = decodeJwt(tokens.accessToken)
      const role    = payload?.role

      // Honour ?next= param set by proxy, but only same-origin paths
      const next = searchParams.get('next')
      if (next?.startsWith('/')) {
        router.push(next)
        return
      }

      router.push(role === 'MANAGER' ? '/dashboard' : '/me')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Invalid email or password'
      setServerError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-9 w-full items-center justify-center gap-2 rounded text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
        onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
      >
        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
        Sign in
      </button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      {/* Wordmark */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={28} />
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Sign in to your account
        </p>
      </div>

      {/* Card */}
      <div
        className="rounded border p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Suspense fallback={<div className="h-48 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />}>
          <LoginForm />
        </Suspense>

        <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          Forgot your password?{' '}
          <span style={{ color: 'var(--text-muted)' }}>Contact your manager to reset it.</span>
        </p>
      </div>
    </div>
  )
}
