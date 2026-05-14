'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { persistAuthTokens } from '@/lib/auth'
import { Logo } from '@/components/shared'
import { Field } from '@/components/auth/Field'
import type { AuthTokens } from '@/lib/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  orgName:  z.string().min(2, 'Organization name is required'),
  orgSlug:  z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(40, 'Slug must be 40 characters or fewer')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and dashes'),
  name:     z.string().min(1, 'Your name is required'),
  email:    z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

// ─── Slug helper ──────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const slugTouched = useRef(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Auto-fill the slug from the org name until the user types in the slug field
  const orgName = watch('orgName')
  useEffect(() => {
    if (slugTouched.current) return
    setValue('orgSlug', slugify(orgName ?? ''), { shouldValidate: false })
  }, [orgName, setValue])

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const { data: tokens } = await api.post<AuthTokens>('/auth/register', data)
      persistAuthTokens(tokens.accessToken, tokens.refreshToken, false)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Could not create your organization. Try again.'
      setServerError(msg)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Wordmark */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={28} />
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Create your organization
        </p>
      </div>

      {/* Card */}
      <div
        className="rounded border p-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="orgName"
            label="Organization name"
            type="text"
            autoComplete="organization"
            placeholder="Acme Inc."
            error={errors.orgName?.message}
            {...register('orgName')}
          />

          <Field
            id="orgSlug"
            label="Organization slug"
            type="text"
            placeholder="acme-inc"
            hint="Lowercase letters, numbers, and dashes. Used in URLs."
            error={errors.orgSlug?.message}
            {...register('orgSlug', {
              onChange: () => { slugTouched.current = true },
            })}
          />

          <Field
            id="name"
            label="Your name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            error={errors.name?.message}
            {...register('name')}
          />

          <Field
            id="email"
            label="Work email"
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
            autoComplete="new-password"
            placeholder="Min. 8 characters"
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
            Create organization
          </button>
        </form>

        <p className="mt-5 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--text-muted)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
