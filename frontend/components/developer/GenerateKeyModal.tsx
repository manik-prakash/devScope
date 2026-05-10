'use client'

import { useState } from 'react'
import { Copy, Check, AlertTriangle, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import type { ApiKeyCreateResponse } from '@/lib/types'

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors duration-150"
      style={{ color: copied ? 'var(--success)' : 'var(--text-faint)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

// ─── Secret row ───────────────────────────────────────────────────────────────

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div
        className="flex items-center gap-2 rounded border px-3 py-2.5"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <span
          className="flex-1 break-all font-mono text-xs"
          style={{ color: 'var(--text)' }}
        >
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ─── Modal state ──────────────────────────────────────────────────────────────

type ModalStep =
  | { kind: 'confirm' }
  | { kind: 'result'; key: string; signingSecret: string }

// ─── Confirm step ─────────────────────────────────────────────────────────────

interface ConfirmStepProps {
  onClose:   () => void
  onGenerate: (key: string, signingSecret: string) => void
}

function ConfirmStep({ onClose, onGenerate }: ConfirmStepProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<ApiKeyCreateResponse>('/developer/api-keys', {
        label: 'Default',
      })
      onGenerate(data.key, data.signing_secret)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to generate API key'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Generate API key
        </h2>
        <p className="mb-6 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          You will only see this key once. Store it immediately — it cannot be recovered after
          this dialog is closed.
        </p>

        {error && (
          <p
            className="mb-4 rounded border px-3 py-2 text-xs"
            style={{
              color:       'var(--danger)',
              borderColor: 'rgba(220,38,38,0.2)',
              background:  'rgba(220,38,38,0.08)',
            }}
          >
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
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
            onClick={handleGenerate}
            disabled={loading}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded text-sm font-medium text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Generate key
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Result step ──────────────────────────────────────────────────────────────

interface ResultStepProps {
  apiKey:        string
  signingSecret: string
  onDone:        () => void
}

function ResultStep({ apiKey, signingSecret, onDone }: ResultStepProps) {
  // No backdrop click — intentionally non-dismissable
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-sm rounded border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* No X button */}
        <h2 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Your new API key
        </h2>
        <p className="mb-5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Copy both values now — they will not be shown again.
        </p>

        <div className="space-y-3">
          <SecretRow label="API key"        value={apiKey}        />
          <SecretRow label="Signing secret" value={signingSecret} />
        </div>

        <div
          className="mt-4 flex items-start gap-2 rounded border px-3 py-2.5"
          style={{
            background:  'rgba(217,119,6,0.08)',
            borderColor: 'rgba(217,119,6,0.2)',
          }}
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Run <span className="font-mono">devscope auth</span> and paste this key when
            prompted. You cannot view this key or signing secret again.
          </p>
        </div>

        <button
          onClick={onDone}
          className="mt-5 h-9 w-full rounded text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)' }}
        >
          I&apos;ve copied it
        </button>
      </div>
    </div>
  )
}

// ─── GenerateKeyModal — composes the two steps ────────────────────────────────

export interface GenerateKeyModalProps {
  onClose:  () => void
  onCreated: () => void    // called after "I've copied it" — triggers key list refetch
}

export function GenerateKeyModal({ onClose, onCreated }: GenerateKeyModalProps) {
  const [step, setStep] = useState<ModalStep>({ kind: 'confirm' })

  if (step.kind === 'confirm') {
    return (
      <ConfirmStep
        onClose={onClose}
        onGenerate={(key, signingSecret) =>
          setStep({ kind: 'result', key, signingSecret })
        }
      />
    )
  }

  return (
    <ResultStep
      apiKey={step.key}
      signingSecret={step.signingSecret}
      onDone={onCreated}
    />
  )
}
