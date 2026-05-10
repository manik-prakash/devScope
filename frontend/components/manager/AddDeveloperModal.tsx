'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  role:  z.enum(['MANAGER', 'DEVELOPER']),
})

type FormData = z.infer<typeof schema>

// ─── Result passed to parent ──────────────────────────────────────────────────

export interface NewDeveloperResult {
  name:         string
  email:        string
  tempPassword: string
}

// ─── Field component ──────────────────────────────────────────────────────────

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
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface AddDeveloperModalProps {
  onClose:   () => void
  onCreated: (result: NewDeveloperResult) => void
}

export function AddDeveloperModal({ onClose, onCreated }: AddDeveloperModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'DEVELOPER' },
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      // TODO: replace with POST /manager/users when backend adds the endpoint
      await new Promise((r) => setTimeout(r, 400))  // simulate network

      // Generate a temporary password (backend would normally do this)
      const chars    = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      const password = 'Tmp@' + Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('')

      onCreated({ name: data.name, email: data.email, tempPassword: password })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to add developer'
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
            Add developer
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded transition-colors duration-150"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)' }}
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

          {/* Role */}
          <div className="space-y-1.5">
            <label htmlFor="role" className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Role
            </label>
            <select
              id="role"
              className="w-full rounded border px-3 text-sm outline-none transition-colors duration-150"
              style={{
                height:      '36px',
                background:  'var(--surface-2)',
                borderColor: 'var(--border)',
                color:       'var(--text)',
              }}
              {...register('role')}
            >
              <option value="DEVELOPER">Developer</option>
              <option value="MANAGER">Manager</option>
            </select>
            {errors.role && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.role.message}</p>
            )}
          </div>

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
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded text-sm font-medium text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              Add developer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
