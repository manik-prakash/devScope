'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { Field } from '@/components/auth/Field'
import type { InvitedUserResult } from '@/lib/types'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
})

type FormData = z.infer<typeof schema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface InviteUserModalProps {
  /** Modal title text (e.g. "Add manager" or "Add engineer"). */
  title:       string
  /** Submit-button label (e.g. "Send invite"). */
  submitLabel: string
  /** API endpoint to POST to. Body is `{ name, email, ...extraBody }`. */
  endpoint:    string
  /** Extra fields to merge into the POST body — e.g. `{ role: 'MANAGER' }`. */
  extraBody?:  Record<string, unknown>
  onClose:     () => void
  onSuccess:   (result: InvitedUserResult) => void
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function InviteUserModal({
  title,
  submitLabel,
  endpoint,
  extraBody,
  onClose,
  onSuccess,
}: InviteUserModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const { data: result } = await api.post<InvitedUserResult>(endpoint, {
        ...data,
        ...extraBody,
      })
      onSuccess(result)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to send invite'
      setServerError(msg)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors duration-150"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="name"
            label="Full name"
            placeholder="Alice Chen"
            error={errors.name?.message}
            {...register('name')}
          />
          <Field
            id="email"
            label="Email"
            type="email"
            placeholder="alice@company.com"
            error={errors.email?.message}
            {...register('email')}
          />

          {serverError && (
            <p
              className="rounded border px-3 py-2 text-xs"
              style={{
                color:       'var(--danger)',
                borderColor: 'rgba(220,38,38,0.2)',
                background:  'rgba(220,38,38,0.08)',
              }}
            >
              {serverError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex-1 rounded border text-sm font-medium transition-colors duration-150"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background  = 'var(--surface-2)'
                e.currentTarget.style.borderColor = 'var(--border-hover)'
                e.currentTarget.style.color       = 'var(--text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background  = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color       = 'var(--text-muted)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded text-sm font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
